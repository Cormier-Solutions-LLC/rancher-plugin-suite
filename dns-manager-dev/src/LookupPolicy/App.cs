using System.Net;
using DnsServerCore.ApplicationCommon;
using TechnitiumLibrary.Net.Dns;
using TechnitiumLibrary.Net.Dns.ResourceRecords;

namespace Cormier.Dns.LookupPolicy;

/// <summary>
/// Prototype DNS App. Keeps source/public caches independent, checks local authoritative
/// data first, and introduces a CNAME for short aliases without rewriting signed owner names.
/// </summary>
public sealed class App : IDnsApplication, IDnsAuthoritativeRequestHandler, IDnsPostProcessor
{
    private Runtime? _runtime;
    public string Description => "Prototype: internal suffixes before public fallback; A/AAAA only.";

    public Task InitializeAsync(IDnsServer dnsServer, string? config)
    {
        var next = new Runtime(dnsServer, PolicyOptions.Parse(config));
        dnsServer.WriteLog($"Cormier DNS policy initialized; enabled={next.Options.Enabled}.");
        Interlocked.Exchange(ref _runtime, next)?.Dispose();
        return Task.CompletedTask;
    }

    public Task<DnsDatagram?> ProcessRequestAsync(DnsDatagram request, IPEndPoint remoteEP,
        DnsTransportProtocol protocol, bool isRecursionAllowed)
    {
        var runtime = _runtime;
        if (runtime is null || !runtime.Options.Enabled || !request.RecursionDesired ||
            !isRecursionAllowed || request.OPCODE != DnsOpcode.StandardQuery ||
            request.Question.Count != 1 || request.Question[0].Class != DnsClass.IN ||
            request.Question[0].Type is not (DnsResourceRecordType.A or DnsResourceRecordType.AAAA))
            return Task.FromResult<DnsDatagram?>(null);
        return runtime.ResolveAsync(request);
    }

    public void Dispose() => Interlocked.Exchange(ref _runtime, null)?.Dispose();

    public Task<DnsDatagram?> PostProcessAsync(DnsDatagram request, IPEndPoint remoteEP,
        DnsTransportProtocol protocol, DnsDatagram response)
    {
        var runtime = _runtime;
        // The core returns authoritative NXDOMAIN before invoking request handlers.
        // Handle that missing-record path here; leave our own non-authoritative responses alone.
        if (runtime is null || !runtime.Options.Enabled || !request.RecursionDesired ||
            !response.RecursionAvailable || !response.AuthoritativeAnswer ||
            response.RCODE != DnsResponseCode.NxDomain || request.Question.Count != 1 ||
            request.Question[0].Class != DnsClass.IN ||
            request.Question[0].Type is not (DnsResourceRecordType.A or DnsResourceRecordType.AAAA) ||
            !runtime.Options.IsInternal(request.Question[0].Name))
            return Task.FromResult<DnsDatagram?>(response);
        return runtime.ResolveAsync(request);
    }

    private sealed class Runtime : IDisposable
    {
        private readonly IDnsServer _server;
        private readonly DnsClient _source;
        private readonly DnsClient _public;
        private readonly DnsCache _sourceCache = new() { MinimumRecordTtl = 0 };
        private readonly DnsCache _publicCache = new() { MinimumRecordTtl = 0 };
        private readonly Timer _cleanup;
        public PolicyOptions Options { get; }

        public Runtime(IDnsServer server, PolicyOptions options)
        {
            _server = server;
            Options = options;
            _source = new DnsClient(options.SourceServer) { Timeout = options.QueryTimeoutMilliseconds, Retries = 1 };
            _public = new DnsClient(options.PublicServer) { Timeout = options.QueryTimeoutMilliseconds, Retries = 1 };
            _cleanup = new Timer(_ => { _sourceCache.RemoveExpiredRecords(); _publicCache.RemoveExpiredRecords(); },
                null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
        }

        public async Task<DnsDatagram?> ResolveAsync(DnsDatagram original)
        {
            using var budget = new CancellationTokenSource(Options.TotalTimeoutMilliseconds);
            try
            {
                var question = original.Question[0];
                var result = await ResolveNameAsync(question.Name, question.Type, new HashSet<string>(StringComparer.OrdinalIgnoreCase), budget.Token);
                var answers = result.Answer.ToList();
                var expanded = !question.Name.Equals(result.Question[0].Name, StringComparison.OrdinalIgnoreCase);
                if (expanded && result.RCODE == DnsResponseCode.NoError && answers.Count > 0)
                {
                    answers.Insert(0, new DnsResourceRecord(question.Name, DnsResourceRecordType.CNAME,
                        DnsClass.IN, answers.Min(record => record.TTL), new DnsCNAMERecordData(result.Question[0].Name)));
                }
                // Synthesized aliases and raw public responses are not locally DNSSEC validated.
                return new DnsDatagram(original.Identifier, true, original.OPCODE, false, false,
                    original.RecursionDesired, true, false, original.CheckingDisabled, result.RCODE,
                    original.Question, answers, result.Authority, result.Additional);
            }
            catch (Exception error) when (error is OperationCanceledException or TimeoutException)
            {
                return Failure(original);
            }
        }

        private async Task<DnsDatagram> ResolveNameAsync(string name, DnsResourceRecordType type,
            HashSet<string> chain, CancellationToken token)
        {
            if (chain.Count >= 16 || !chain.Add(name))
                throw new TimeoutException("CNAME loop/depth limit.");
            var candidates = Options.Candidates(name);
            DnsDatagram? lastNegative = null;
            var failed = false;

            foreach (var candidate in candidates)
            {
                token.ThrowIfCancellationRequested();
                var question = new DnsQuestionRecord(candidate, type, DnsClass.IN);
                var query = Query(question, false);
                // IsLocallyServedZone identifies RFC special-use zones, not our secondary-zone inventory.
                // A nonrecursive direct query safely reads ordinary authoritative zones without reentering Apps.
                DnsDatagram? response = await _server.DirectQueryAsync(query, Options.QueryTimeoutMilliseconds, token);
                if (!response.AuthoritativeAnswer) response = null;
                if (response is null || response.RCODE == DnsResponseCode.NxDomain ||
                    response.RCODE is DnsResponseCode.ServerFailure or DnsResponseCode.Refused)
                {
                    if (Options.IsInternal(candidate))
                        response = await UpstreamAsync(_source, _sourceCache, query, token);
                }
                if (response is null) { if (Options.IsInternal(candidate)) failed = true; continue; }
                if (response.RCODE == DnsResponseCode.NoError)
                    return await CompleteAliasAsync(response, type, chain, token);
                if (response.RCODE == DnsResponseCode.NxDomain) lastNegative = response;
                else failed = true;
            }

            foreach (var candidate in candidates)
            {
                var response = await UpstreamAsync(_public, _publicCache,
                    Query(new DnsQuestionRecord(candidate, type, DnsClass.IN), true), token);
                if (response is null) { failed = true; continue; }
                if (response.RCODE == DnsResponseCode.NoError)
                    return await CompleteAliasAsync(response, type, chain, token);
                if (response.RCODE == DnsResponseCode.NxDomain) lastNegative = response;
                else failed = true;
            }
            // No data is terminal NOERROR; errors are not converted to a definitive negative.
            return failed || lastNegative is null ? Failure(Query(new(name, type, DnsClass.IN), true)) : lastNegative;
        }

        private async Task<DnsDatagram> CompleteAliasAsync(DnsDatagram response, DnsResourceRecordType type,
            HashSet<string> chain, CancellationToken token)
        {
            if (response.Answer.Any(record => record.Type == type)) return response;
            var aliases = response.Answer.Where(record => record.Type == DnsResourceRecordType.CNAME).ToArray();
            if (aliases.Length == 0) return response; // NODATA: preserve standard semantics.
            var target = ((DnsCNAMERecordData)aliases[^1].RDATA).Domain;
            var resolved = await ResolveNameAsync(target, type, chain, token);
            return new DnsDatagram(response.Identifier, true, response.OPCODE, false, false,
                true, true, false, false, resolved.RCODE, response.Question,
                response.Answer.Concat(resolved.Answer).ToArray(), resolved.Authority, resolved.Additional);
        }

        private static async Task<DnsDatagram?> UpstreamAsync(DnsClient client, DnsCache cache,
            DnsDatagram query, CancellationToken token)
        {
            var cached = await cache.QueryAsync(query);
            if (cached is not null) return cached;
            try
            {
                var response = await client.RawResolveAsync(query, token);
                if (response.RCODE is DnsResponseCode.NoError or DnsResponseCode.NxDomain)
                    cache.CacheResponse(response);
                return response;
            }
            catch (Exception error) when (error is OperationCanceledException or TimeoutException or DnsClientException)
            {
                if (token.IsCancellationRequested) throw new OperationCanceledException(token);
                return null;
            }
        }

        private static DnsDatagram Query(DnsQuestionRecord question, bool recurse) =>
            new(0, false, DnsOpcode.StandardQuery, false, false, recurse, false, false, false,
                DnsResponseCode.NoError, [question]);

        private static DnsDatagram Failure(DnsDatagram query) =>
            new(query.Identifier, true, query.OPCODE, false, false, query.RecursionDesired, true,
                false, query.CheckingDisabled, DnsResponseCode.ServerFailure, query.Question);

        public void Dispose() => _cleanup.Dispose();
    }
}

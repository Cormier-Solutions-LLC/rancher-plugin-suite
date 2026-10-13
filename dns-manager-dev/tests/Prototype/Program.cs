using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Cormier.Dns.LookupPolicy;
using TechnitiumLibrary.Net.Dns;
using TechnitiumLibrary.Net.Dns.ResourceRecords;

var root = Path.GetFullPath(args.Length == 0 ? "dns-manager-dev" : args[0]);
var secret = (await File.ReadAllTextAsync(Path.Combine(root, ".state", "admin-password.txt"))).Trim();
var checks = new List<object>();
var source = new Api(15380, secret);
var external = new Api(15381, secret);
var replicas = new[] { new Api(15382, secret), new Api(15383, secret), new Api(15384, secret) };
var zones = new[] { "cormierconsulting.io", "cormierconsulting.com" };
const string io = "cormierconsulting.io", com = "cormierconsulting.com";
var failed = false;

async Task Check(string name, Func<Task> action)
{
    var watch = Stopwatch.StartNew();
    await action();
    checks.Add(new { name, passed = true, milliseconds = watch.ElapsedMilliseconds });
    Console.WriteLine($"PASS {name}");
}

try
{
    foreach (var server in new[] { source, external }.Concat(replicas)) await server.LoginAsync();
    // Reset only this isolated project's fixture configuration, making reruns deterministic.
    foreach (var server in new[] { source, external }.Concat(replicas))
    {
        foreach (var zone in zones.Concat(["google.com"])) await server.TryDeleteZoneAsync(zone);
        await server.CallAsync("settings/set", new() { ["dnssecValidation"] = "false", ["minSoaRefresh"] = "1",
            ["minSoaRetry"] = "1", ["logQueries"] = "true", ["dnsAppsEnableAutomaticUpdate"] = "false" });
    }
    foreach (var zone in zones)
    {
        await source.ZoneAsync(zone);
        await source.CallAsync("zones/options/set", new() { ["zone"] = zone,
            ["zoneTransfer"] = "UseSpecifiedNetworkACL", ["zoneTransferNetworkACL"] = "172.30.239.0/24", ["notify"] = "None" });
        await external.ZoneAsync(zone);
    }
    await external.ZoneAsync("google.com");
    await source.AddressAsync($"testing.{io}", "192.0.2.11");
    await source.AddressAsync($"testing.{com}", "192.0.2.12");
    await source.AddressAsync($"comwins.{com}", "192.0.2.12");
    await source.AddressAsync($"test.something.{io}", "192.0.2.13");
    await source.AddressAsync($"target.{com}", "192.0.2.14");
    await source.AddressAsync($"dual.{io}", "2001:db8::11", "AAAA");
    await source.CallAsync("zones/records/add", new() { ["domain"] = $"alias.{io}", ["type"] = "CNAME",
        ["cname"] = $"target.{com}", ["ttl"] = "60", ["overwrite"] = "true" });
    await external.AddressAsync($"comwins.{io}", "192.0.2.21");
    await external.AddressAsync($"outside.{io}", "192.0.2.21");
    await external.AddressAsync($"second.{com}", "192.0.2.22");
    await external.AddressAsync("test.something.google.com", "192.0.2.23");
    await external.AddressAsync($"testing.{io}", "2001:db8::99", "AAAA");

    var packageDir = Path.Combine(root, "artifacts");
    Directory.CreateDirectory(packageDir);
    var package = Path.Combine(packageDir, "LookupPolicy.zip");
    var assembly = typeof(App).Assembly.Location;
    using (var zip = new ZipArchive(File.Create(package), ZipArchiveMode.Create))
    {
        zip.CreateEntryFromFile(assembly, "Cormier.Dns.LookupPolicy.dll");
        zip.CreateEntryFromFile(Path.ChangeExtension(assembly, ".deps.json"), "Cormier.Dns.LookupPolicy.deps.json");
        using var writer = new StreamWriter(zip.CreateEntry("dnsApp.config").Open());
        await writer.WriteAsync(JsonSerializer.Serialize(new PolicyOptions { Enabled = true,
            SourceServer = "172.30.239.10", PublicServer = "172.30.239.20", ValidatePublicDnssec = false }));
    }
    foreach (var replica in replicas)
    {
        await replica.InstallAsync(package);
        foreach (var zone in zones)
        {
            await replica.CallAsync("zones/create", new() { ["zone"] = zone, ["type"] = "Secondary",
                ["primaryNameServerAddresses"] = "172.30.239.10", ["zoneTransferProtocol"] = "Tcp" });
            await replica.WaitForZoneAsync(zone);
        }
    }

    await Check("All three replicas persist independently transferred zones", async () =>
    {
        for (var index = 0; index < replicas.Length; index++)
            AssertAddress(await QueryAsync(15355 + index, $"testing.{io}"), "192.0.2.11");
    });
    await Check("Short name uses internal .io before internal .com", async () =>
    {
        var answer = await QueryAsync(15355, "testing");
        AssertAddress(answer, "192.0.2.11");
        Assert(answer.Question[0].Name == "testing", "Original question must be preserved.");
        Assert(answer.Answer.Any(record => record.Name == "testing" && record.Type == DnsResourceRecordType.CNAME),
            "Short alias must be represented by a CNAME, not corrupt owner rewriting.");
        Assert(!answer.AuthenticData, "Synthetic alias must not claim DNSSEC authentication.");
    });
    await Check("Internal .com outranks public .io", async () =>
        AssertAddress(await QueryAsync(15355, "comwins"), "192.0.2.12"));
    await Check("Miss reaches public .io", async () =>
        AssertAddress(await QueryAsync(15355, "outside"), "192.0.2.21"));
    await Check("Public .com follows public .io negative", async () =>
        AssertAddress(await QueryAsync(15355, "second"), "192.0.2.22"));
    await Check("Multi-level public FQDN remains exact", async () =>
    {
        var answer = await QueryAsync(15355, "test.something.google.com");
        AssertAddress(answer, "192.0.2.23");
        Assert(answer.Question[0].Name == "test.something.google.com", "FQDN changed.");
    });
    await Check("Multi-level internal FQDN remains exact", async () =>
        AssertAddress(await QueryAsync(15355, $"test.something.{io}"), "192.0.2.13"));
    await Check("AAAA and cross-zone CNAME chain resolve", async () =>
    {
        AssertAddress(await QueryAsync(15355, "dual", DnsResourceRecordType.AAAA), "2001:db8::11");
        AssertAddress(await QueryAsync(15355, "alias"), "192.0.2.14");
    });
    await Check("NODATA does not become public AAAA for an internal host", async () =>
    {
        var answer = await QueryAsync(15355, $"testing.{io}", DnsResourceRecordType.AAAA);
        Assert(answer.RCODE == DnsResponseCode.NoError && answer.Answer.Count == 0, "Expected terminal NODATA.");
    });
    await Check("DNS-over-TCP uses the same policy", async () =>
        AssertAddress(await QueryAsync(15355, "comwins", transport: DnsTransportProtocol.Tcp), "192.0.2.12"));
    await Check("New source record is available before next secondary transfer", async () =>
    {
        await source.AddressAsync($"fresh.{io}", "192.0.2.15", ttl: "120");
        AssertAddress(await QueryAsync(15355, "fresh"), "192.0.2.15");
        AssertAddress(await QueryAsync(15356, $"fresh.{io}"), "192.0.2.15");
    });
    await Check("Exact internal FQDN miss falls through to public without adding suffixes", async () =>
        AssertAddress(await QueryAsync(15355, $"second.{com}"), "192.0.2.22"));
    await Check("Positive source cache respects TTL expiry", async () =>
    {
        await source.AddressAsync($"ttlcheck.{io}", "192.0.2.40", ttl: "2");
        AssertAddress(await QueryAsync(15355, "ttlcheck"), "192.0.2.40");
        await source.AddressAsync($"ttlcheck.{io}", "192.0.2.41", ttl: "2");
        AssertAddress(await QueryAsync(15355, "ttlcheck"), "192.0.2.40");
        await Task.Delay(2500);
        AssertAddress(await QueryAsync(15355, "ttlcheck"), "192.0.2.41");
    });
    await Check("All stages negative preserve NXDOMAIN", async () =>
    {
        var answer = await QueryAsync(15355, "absent");
        Assert(answer.RCODE == DnsResponseCode.NxDomain && answer.Question[0].Name == "absent",
            "Expected original-question NXDOMAIN.");
    });
    await Check("CNAME loop terminates within the request budget", async () =>
    {
        await source.CallAsync("zones/records/add", new() { ["domain"] = $"loopa.{io}", ["type"] = "CNAME",
            ["cname"] = $"loopb.{com}", ["ttl"] = "60" });
        await source.CallAsync("zones/records/add", new() { ["domain"] = $"loopb.{com}", ["type"] = "CNAME",
            ["cname"] = $"loopa.{io}", ["ttl"] = "60" });
        var watch = Stopwatch.StartNew();
        var answer = await QueryAsync(15355, "loopa");
        Assert(answer.RCODE == DnsResponseCode.ServerFailure && watch.Elapsed < TimeSpan.FromSeconds(4),
            "CNAME loop must produce bounded SERVFAIL.");
    });
    await Check("Large UDP response retries over TCP without losing records", async () =>
    {
        for (var index = 1; index <= 40; index++)
            await external.AddressAsync("large.google.com", $"192.0.2.{index}", overwrite: false);
        // overwrite=false is required to build an RRset rather than replace each prior address.
        var answer = await QueryAsync(15355, "large.google.com");
        Assert(answer.Answer.Count(record => record.Type == DnsResourceRecordType.A) == 40,
            "Expected all 40 A records after transport retry.");
    });
    await Check("Cached public .io does not outrank newly replicated internal .com", async () =>
    {
        await source.AddressAsync($"outside.{com}", "192.0.2.16");
        await replicas[0].CallAsync("zones/resync", new() { ["zone"] = com });
        await replicas[0].WaitForRecordAsync(com, $"outside.{com}");
        AssertAddress(await QueryAsync(15355, "outside"), "192.0.2.16");
    });
    await Check("Transferred positive data supersedes cached source NXDOMAIN", async () =>
    {
        Assert((await QueryAsync(15355, "negativecheck")).RCODE == DnsResponseCode.NxDomain, "Expected initial NXDOMAIN.");
        await source.AddressAsync($"negativecheck.{io}", "192.0.2.50");
        Assert((await QueryAsync(15355, "negativecheck")).RCODE == DnsResponseCode.NxDomain,
            "Cached source negative must retain its TTL until replication supplies authoritative data.");
        await replicas[0].CallAsync("zones/resync", new() { ["zone"] = io });
        await replicas[0].WaitForRecordAsync(io, $"negativecheck.{io}", "192.0.2.50");
        AssertAddress(await QueryAsync(15355, "negativecheck"), "192.0.2.50");
    });
    await Check("Nonrecursive query keeps ordinary authoritative semantics", async () =>
    {
        var answer = await QueryAsync(15355, $"absent.{io}", recurse: false);
        Assert(answer.RCODE == DnsResponseCode.NxDomain && answer.AuthoritativeAnswer,
            "Policy must not apply recursive fallback to an authoritative-only query.");
    });

    await ComposeAsync(root, "stop", "--timeout", "1", "source");
    await Check("Source cache keeps fresh record available during source outage", async () =>
        AssertAddress(await QueryAsync(15355, "fresh"), "192.0.2.15"));
    await Check("Source timeout is not cached as a definitive NXDOMAIN", async () =>
    {
        var answer = await QueryAsync(15355, "unknownoutage");
        Assert(answer.RCODE == DnsResponseCode.ServerFailure, "Uncertain source miss must remain SERVFAIL.");
    });
    await Check("Source outage is bounded and permits public fallback", async () =>
    {
        // Warm only the public fixture, not the source miss, to measure a true outage path.
        await external.AddressAsync($"outage.{io}", "192.0.2.24");
        var watch = Stopwatch.StartNew();
        AssertAddress(await QueryAsync(15355, "outage"), "192.0.2.24");
        Assert(watch.Elapsed < TimeSpan.FromSeconds(4), "Exceeded query latency budget.");
    });
    await Check("Restarted replica serves retained zones while source remains stopped", async () =>
    {
        await ComposeAsync(root, "restart", "--timeout", "1", "dns01");
        await replicas[0].LoginAsync();
        AssertAddress(await QueryAsync(15355, "testing"), "192.0.2.11");
    });
    await Check("Two replicas continue serving while one replica is stopped", async () =>
    {
        await ComposeAsync(root, "stop", "--timeout", "1", "dns01");
        AssertAddress(await QueryAsync(15356, "testing"), "192.0.2.11");
        AssertAddress(await QueryAsync(15357, "testing"), "192.0.2.11");
    });
    await ComposeAsync(root, "start", "source", "dns01");
    await source.LoginAsync();
    await replicas[0].LoginAsync();
    await Check("Source return propagates a changed record to every replica", async () =>
    {
        await source.AddressAsync($"testing.{io}", "192.0.2.31");
        for (var index = 0; index < replicas.Length; index++)
        {
            await replicas[index].CallAsync("zones/resync", new() { ["zone"] = io });
            await replicas[index].WaitForRecordAsync(io, $"testing.{io}", "192.0.2.31");
            AssertAddress(await QueryAsync(15355 + index, "testing"), "192.0.2.31");
        }
    });
}
catch (Exception error)
{
    failed = true;
    checks.Add(new { name = "Prototype execution", passed = false, reason = error.Message });
    Console.Error.WriteLine($"FAIL {error.Message}");
}
finally
{
    Directory.CreateDirectory(Path.Combine(root, "artifacts"));
    await File.WriteAllTextAsync(Path.Combine(root, "artifacts", "results.json"),
        JsonSerializer.Serialize(new { capturedAt = DateTimeOffset.UtcNow, fixtureOnly = true, checks },
            new JsonSerializerOptions { WriteIndented = true }));
    // Stop only this explicitly named local project; retain its independent volumes for inspection.
    await ComposeAsync(root, "stop", "--timeout", "1");
}
return failed ? 1 : 0;

static void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
static void AssertAddress(DnsDatagram answer, string expected)
{
    var addresses = answer.Answer.Select(record => record.RDATA switch
    {
        DnsARecordData ipv4 => ipv4.Address.ToString(),
        DnsAAAARecordData ipv6 => ipv6.Address.ToString(),
        _ => ""
    }).ToArray();
    Assert(answer.RCODE == DnsResponseCode.NoError && addresses.Contains(expected),
        $"Expected {expected}; received {answer.RCODE} with [{string.Join(",", addresses.Where(value => value.Length > 0))}].");
}
static Task<DnsDatagram> QueryAsync(int port, string name, DnsResourceRecordType type = DnsResourceRecordType.A,
    DnsTransportProtocol transport = DnsTransportProtocol.Udp, bool recurse = true)
{
    var client = new DnsClient($"127.0.0.1:{port}", transport) { Timeout = 5000, Retries = 1 };
    return client.RawResolveAsync(new DnsDatagram(12345, false, DnsOpcode.StandardQuery, false, false,
        recurse, false, false, false, DnsResponseCode.NoError, [new(name, type, DnsClass.IN)]));
}
static async Task ComposeAsync(string root, params string[] arguments)
{
    var start = new ProcessStartInfo("docker") { RedirectStandardOutput = true, RedirectStandardError = true,
        UseShellExecute = false, CreateNoWindow = true };
    foreach (var argument in new[] { "compose", "-f", Path.Combine(root, "compose.prototype.yaml") }.Concat(arguments))
        start.ArgumentList.Add(argument);
    using var process = Process.Start(start) ?? throw new InvalidOperationException("Cannot start local Docker command.");
    var output = process.StandardOutput.ReadToEndAsync();
    var error = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    await Task.WhenAll(output, error);
    if (process.ExitCode != 0) throw new InvalidOperationException("Local prototype Docker command failed: " + error.Result);
}

sealed class Api(int port, string password)
{
    private readonly HttpClient _client = new() { BaseAddress = new Uri($"http://127.0.0.1:{port}/api/"),
        Timeout = TimeSpan.FromSeconds(5) };

    public async Task LoginAsync()
    {
        for (var attempt = 0; attempt < 30; attempt++)
        {
            try
            {
                var result = await CallAsync("user/login", new() { ["user"] = "admin", ["pass"] = password });
                _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", result.GetProperty("token").GetString());
                return;
            }
            catch (Exception) when (attempt < 29) { await Task.Delay(500); }
        }
        throw new InvalidOperationException("Fixture API did not become available.");
    }

    public async Task<JsonElement> CallAsync(string path, Dictionary<string, string>? values = null)
    {
        using var response = await _client.PostAsync(path, new FormUrlEncodedContent(values ?? []));
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Fixture API {path}: HTTP {(int)response.StatusCode}.");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (json.RootElement.GetProperty("status").GetString() != "ok")
            throw new InvalidOperationException($"Fixture API {path}: " +
                (json.RootElement.TryGetProperty("errorMessage", out var error) ? error.GetString() : "failed"));
        return json.RootElement.Clone();
    }

    public async Task InstallAsync(string path)
    {
        try { await CallAsync("apps/uninstall", new() { ["name"] = "Cormier Lookup Policy" }); }
        catch (InvalidOperationException) { }
        using var form = new MultipartFormDataContent();
        var data = new StreamContent(File.OpenRead(path));
        data.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        form.Add(data, "file", "LookupPolicy.zip");
        using var response = await _client.PostAsync("apps/install?name=Cormier%20Lookup%20Policy", form);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (json.RootElement.GetProperty("status").GetString() != "ok")
            throw new InvalidOperationException("DNS App installation failed: " + json.RootElement.GetProperty("errorMessage").GetString());
    }

    public async Task TryDeleteZoneAsync(string zone)
    {
        try { await CallAsync("zones/delete", new() { ["zone"] = zone }); }
        catch (InvalidOperationException) { }
    }
    public Task<JsonElement> ZoneAsync(string zone) => CallAsync("zones/create", new() { ["zone"] = zone, ["type"] = "Primary" });
    public Task<JsonElement> AddressAsync(string name, string address, string type = "A", string ttl = "60", bool overwrite = true) =>
        CallAsync("zones/records/add", new() { ["domain"] = name, ["type"] = type,
            ["ipAddress"] = address, ["ttl"] = ttl, ["overwrite"] = overwrite ? "true" : "false" });

    public async Task WaitForZoneAsync(string zone)
    {
        for (var attempt = 0; attempt < 40; attempt++)
        {
            var json = await CallAsync("zones/list");
            var item = json.GetProperty("response").GetProperty("zones").EnumerateArray()
                .FirstOrDefault(item => item.GetProperty("name").GetString() == zone);
            if (item.ValueKind != JsonValueKind.Undefined && !item.GetProperty("isExpired").GetBoolean()) return;
            await Task.Delay(250);
        }
        throw new InvalidOperationException("Fixture secondary zone did not transfer: " + zone);
    }

    public async Task WaitForRecordAsync(string zone, string name, string? address = null)
    {
        for (var attempt = 0; attempt < 40; attempt++)
        {
            var json = await CallAsync("zones/records/get", new() { ["zone"] = zone, ["domain"] = zone, ["listZone"] = "true" });
            if (json.GetProperty("response").GetProperty("records").EnumerateArray().Any(record =>
                record.GetProperty("name").GetString() == name &&
                (address is null || record.GetProperty("rData").GetProperty("ipAddress").GetString() == address))) return;
            await Task.Delay(250);
        }
        throw new InvalidOperationException("Fixture secondary did not receive expected record: " + name);
    }
}

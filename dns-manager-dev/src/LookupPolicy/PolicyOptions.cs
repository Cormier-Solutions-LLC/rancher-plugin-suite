using System.Text.Json;

namespace Cormier.Dns.LookupPolicy;

/// <summary>Explicit query policy; source and public servers must be IP endpoints.</summary>
public sealed record PolicyOptions
{
    public bool Enabled { get; init; }
    public string[] SearchSuffixes { get; init; } = ["cormierconsulting.io", "cormierconsulting.com"];
    public string[] InternalZones { get; init; } = ["cormierconsulting.io", "cormierconsulting.com"];
    public string SourceServer { get; init; } = "10.99.3.2";
    public string PublicServer { get; init; } = "8.8.8.8";
    public int QueryTimeoutMilliseconds { get; init; } = 500;
    public int TotalTimeoutMilliseconds { get; init; } = 4000;

    public static PolicyOptions Parse(string? json)
    {
        var options = JsonSerializer.Deserialize<PolicyOptions>(json ?? "{}",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        if (options.QueryTimeoutMilliseconds is < 100 or > 2000 ||
            options.TotalTimeoutMilliseconds is < 500 or > 10000)
            throw new ArgumentException("Query/total timeouts are outside prototype bounds.");
        if (options.SearchSuffixes.Length is < 1 or > 8 || options.InternalZones.Length == 0)
            throw new ArgumentException("At least one suffix and internal zone are required.");
        foreach (var suffix in options.SearchSuffixes.Concat(options.InternalZones))
            if (string.IsNullOrWhiteSpace(suffix) || suffix.StartsWith('.') || suffix.EndsWith('.') ||
                suffix.Contains(' ') || suffix.Split('.').Any(label => label.Length is < 1 or > 63))
                throw new ArgumentException("Policy domain names must be valid nonempty labels.");
        ValidateEndpoint(options.SourceServer);
        ValidateEndpoint(options.PublicServer);
        if (options.SourceServer == options.PublicServer)
            throw new ArgumentException("Source and public servers must be distinct.");
        return options;
    }

    private static void ValidateEndpoint(string value)
    {
        // IPv4[:port] / [IPv6]:port accepted; DNS hostnames would create bootstrap dependencies.
        if (System.Net.IPAddress.TryParse(value, out _)) return;
        if (!System.Net.IPEndPoint.TryParse(value, out var endpoint) || endpoint.Port is < 1 or > 65535)
            throw new ArgumentException("Use an IP address or an IP:port endpoint.");
    }

    public bool IsInternal(string name) => InternalZones.Any(zone =>
        name.Equals(zone, StringComparison.OrdinalIgnoreCase) ||
        name.EndsWith('.' + zone, StringComparison.OrdinalIgnoreCase));

    public string[] Candidates(string name) => name.Contains('.') || name.Length == 0
        ? [name]
        : SearchSuffixes.Select(suffix => name + '.' + suffix).ToArray();
}

using System.Net;
using System.Net.Sockets;

// Fixed fixture destinations only. The gateway does not route IP packets or accept a target from clients.
var maps = new[] { ("172.30.239.10", 15380, 15353), ("172.30.239.20", 15381, 15354),
    ("172.30.239.31", 15382, 15355), ("172.30.239.32", 15383, 15356), ("172.30.239.33", 15384, 15357) };
await Task.WhenAll(maps.SelectMany(map => new[] { TcpAsync(map.Item2, map.Item1, 5380),
    TcpAsync(map.Item3, map.Item1, 53), UdpAsync(map.Item3, map.Item1) }));

static async Task TcpAsync(int port, string target, int targetPort)
{
    var listener = new TcpListener(IPAddress.Any, port);
    listener.Start();
    while (true)
    {
        var client = await listener.AcceptTcpClientAsync();
        _ = RelayAsync(client, target, targetPort);
    }
}
static async Task RelayAsync(TcpClient client, string target, int port)
{
    using (client)
    using (var upstream = new TcpClient())
    using (var budget = new CancellationTokenSource(TimeSpan.FromSeconds(15)))
    {
        try
        {
            await upstream.ConnectAsync(target, port, budget.Token);
            await Task.WhenAny(client.GetStream().CopyToAsync(upstream.GetStream(), budget.Token),
                upstream.GetStream().CopyToAsync(client.GetStream(), budget.Token));
        }
        catch (Exception error) when (error is SocketException or IOException or OperationCanceledException) { }
    }
}
static async Task UdpAsync(int port, string target)
{
    using var listener = new UdpClient(port);
    while (true)
    {
        var request = await listener.ReceiveAsync();
        _ = RelayDatagramAsync(listener, request, target);
    }
}
static async Task RelayDatagramAsync(UdpClient listener, UdpReceiveResult request, string target)
{
    using var upstream = new UdpClient();
    using var budget = new CancellationTokenSource(TimeSpan.FromSeconds(6));
    try
    {
        upstream.Connect(target, 53);
        await upstream.SendAsync(request.Buffer, budget.Token);
        var response = await upstream.ReceiveAsync(budget.Token);
        await listener.SendAsync(response.Buffer, request.RemoteEndPoint, budget.Token);
    }
    catch (Exception error) when (error is SocketException or OperationCanceledException) { }
}

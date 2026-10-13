using System.Net.Sockets;
using System.Text;

// Source-independent readiness: each required retained zone must answer an SOA
// over both DNS transports. This does not contact the Windows source.
try
{
    foreach (var zone in args.Length > 0 ? args : ["cormierconsulting.io", "cormierconsulting.com", "_msdcs.cormierconsulting.com", "99.10.in-addr.arpa"])
    {
        using var packet = new MemoryStream();
        packet.Write(new byte[] { 0x43, 0x4d, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 });
        foreach (var label in zone.Split('.')) { var bytes = Encoding.ASCII.GetBytes(label); packet.WriteByte((byte)bytes.Length); packet.Write(bytes); }
        packet.Write(new byte[] { 0, 0, 6, 0, 1 });
        var query = packet.ToArray();
        using var udp = new UdpClient();
        udp.Connect("127.0.0.1", 53);
        await udp.SendAsync(query);
        Check((await udp.ReceiveAsync().WaitAsync(TimeSpan.FromSeconds(2))).Buffer, zone);
        using var tcp = new TcpClient();
        await tcp.ConnectAsync("127.0.0.1", 53).WaitAsync(TimeSpan.FromSeconds(2));
        var stream = tcp.GetStream();
        await stream.WriteAsync(new byte[] { (byte)(query.Length >> 8), (byte)query.Length });
        await stream.WriteAsync(query);
        var length = new byte[2];
        await stream.ReadExactlyAsync(length).AsTask().WaitAsync(TimeSpan.FromSeconds(2));
        var answer = new byte[(length[0] << 8) | length[1]];
        await stream.ReadExactlyAsync(answer).AsTask().WaitAsync(TimeSpan.FromSeconds(2));
        Check(answer, zone);
    }
    return 0;
}
catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
static void Check(byte[] response, string zone)
{
    if (response.Length < 12 || response[0] != 0x43 || response[1] != 0x4d || (response[2] & 0x84) != 0x84 || (response[3] & 15) != 0 || (response[6] << 8 | response[7]) == 0)
        throw new InvalidOperationException($"Local authoritative SOA is unavailable: {zone}");
}

using System.Text.Json;
using TechnitiumLibrary.Net.Dns;
using TechnitiumLibrary.Net.Dns.ResourceRecords;
try {
 var client=new DnsClient(args[0],args.Length>3 && args[3]=="tcp"?DnsTransportProtocol.Tcp:DnsTransportProtocol.Udp){Timeout=2000,Retries=1};
 var type=Enum.Parse<DnsResourceRecordType>(args[2]);
 var answer=await client.RawResolveAsync(new DnsDatagram(12345,false,DnsOpcode.StandardQuery,false,false,true,false,false,false,DnsResponseCode.NoError,[new DnsQuestionRecord(args[1],type,DnsClass.IN)]));
 Console.WriteLine(JsonSerializer.Serialize(new {rcode=answer.RCODE.ToString(),authoritative=answer.AuthoritativeAnswer,answers=answer.Answer.Select(r=>new{name=r.Name,type=r.Type.ToString(),ttl=r.TTL,value=r.RDATA.ToString()})}));
 return 0;
}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}

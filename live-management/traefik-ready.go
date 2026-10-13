// Verify the proxy's local Kubernetes route before Kubernetes advertises this pod.
// Uses the existing pod credential and verifies the actual backend CA/server name.
package main

import (
 "crypto/tls"
 "crypto/x509"
 "net/http"
 "os"
 "strings"
 "time"
)

func main() {
 const directory = "/var/run/secrets/kubernetes.io/serviceaccount/"
 ca, err := os.ReadFile(directory+"ca.crt"); if err != nil { os.Exit(1) }
 token, err := os.ReadFile(directory+"token"); if err != nil { os.Exit(1) }
 roots := x509.NewCertPool(); if !roots.AppendCertsFromPEM(ca) { os.Exit(1) }
 client := &http.Client{Timeout:2*time.Second,Transport:&http.Transport{TLSClientConfig:&tls.Config{RootCAs:roots,ServerName:"kubernetes.default.svc",MinVersion:tls.VersionTLS12}}}
 request, err := http.NewRequest(http.MethodGet,"https://127.0.0.1:6443/readyz",nil); if err != nil { os.Exit(1) }
 request.Header.Set("Authorization","Bearer "+strings.TrimSpace(string(token)))
 response, err := client.Do(request); if err != nil { os.Exit(1) }
 defer response.Body.Close()
 if response.StatusCode != http.StatusOK { os.Exit(1) }
}

{{- define "public-edge.nginx" -}}
worker_processes auto;
worker_shutdown_timeout 10s;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 4096; }
http {
  server_tokens off;
  map_hash_bucket_size 1024;
  server_names_hash_bucket_size 512;
  log_format edge '$remote_addr $request_method $uri host="$host" status=$status';
  access_log /dev/stdout edge;
  client_body_temp_path /tmp/client_body;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  client_header_timeout 10s;
  client_body_timeout 60s;
  send_timeout 60s;
  keepalive_timeout 30s;
  client_max_body_size 0;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_tickets off;
  ssl_session_cache shared:edge_tls:10m;
  ssl_certificate_cache max=2 inactive=1m valid=30s;
  # Constant paths, evaluated at handshake time so mounted certificate renewals
  # are picked up without copying private keys or restarting pods.
  map $ssl_server_name $certificate_file { default /tls/tls.crt; }
  map $ssl_server_name $certificate_key { default /tls/tls.key; }
  map $http_host $public_host {
    default "";
{{- range .Values.publicHosts }}
    ~*^{{ regexQuoteMeta . }}(:80|:443)?$ {{ . }};
{{- end }}
  }
  map "$ssl_server_name:$public_host" $sni_matches_host {
    default 0;
{{- range .Values.publicHosts }}
    "{{ . }}:{{ . }}" 1;
{{- end }}
  }
  map $http_upgrade $connection_upgrade { default upgrade; '' close; }
  # Parser errors (including HTTP/1.1 without Host) close the connection too.
  error_page 400 414 421 494 495 496 497 = @drop;
  server {
    listen 8080 default_server;
    server_name _ "";
    location @drop { return 444; }
    location / { return 444; }
  }
  server {
    listen 8443 ssl default_server;
    http2 on;
    server_name _ "";
    ssl_reject_handshake on;
    location @drop { return 444; }
    location / { return 444; }
  }
{{- if .Values.publicHosts }}
  upstream private_traefik {
    server {{ .Values.upstream.host }}:{{ .Values.upstream.port }};
    keepalive 32;
  }
  server {
    listen 8080;
    server_name {{ join " " .Values.publicHosts }};
    if ($public_host = "") { return 444; }
    if ($host != $public_host) { return 444; }
    location @drop { return 444; }
    location / { return 308 https://$public_host$request_uri; }
  }
  server {
    listen 8443 ssl;
    http2 on;
    server_name {{ join " " .Values.publicHosts }};
    ssl_certificate $certificate_file;
    ssl_certificate_key $certificate_key;
    if ($public_host = "") { return 444; }
    if ($host != $public_host) { return 444; }
    if ($sni_matches_host = 0) { return 444; }
    location @drop { return 444; }
    location / {
      proxy_pass https://private_traefik;
      proxy_http_version 1.1;
      proxy_ssl_server_name on;
      proxy_ssl_name $public_host;
      proxy_ssl_verify on;
      proxy_ssl_trusted_certificate {{ .Values.upstream.caBundle }};
      proxy_ssl_verify_depth 4;
      proxy_set_header Host $public_host;
      proxy_set_header X-Forwarded-Host $public_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-Port 443;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header Forwarded "";
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Upgrade $http_upgrade;
      proxy_read_timeout 3600s;
      proxy_send_timeout 3600s;
      proxy_request_buffering off;
      proxy_buffering off;
    }
  }
{{- end }}
  server {
    listen 8081;
    server_name _;
    access_log off;
    location = /ready { return 200 'ready\n'; }
    location / { return 404; }
  }
}
{{- end -}}

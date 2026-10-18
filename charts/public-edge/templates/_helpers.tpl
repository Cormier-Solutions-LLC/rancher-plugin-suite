{{- define "public-edge.name" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "public-edge.selector" -}}
app.kubernetes.io/name: public-edge
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

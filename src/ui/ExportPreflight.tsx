import type { ExportIssue } from '../domain/preflight';
export function ExportPreflight({ issues }: { issues: ExportIssue[] }) {
  return (
    <details className={issues.some((issue) => issue.blocking) ? 'notice' : 'muted'}>
      <summary>
        {issues.length
          ? `${issues.length} ponto(s) para conferir antes de exportar`
          : 'Conferência: cortes, dimensões e referências de fontes válidos'}
      </summary>
      {issues.length ? (
        <ul>
          {issues.map((issue, index) => (
            <li key={`${issue.itemId}-${index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : (
        <small>
          Disponibilidade de codecs, permissões da pasta e integridade das fontes são verificadas durante a preparação e execução.
        </small>
      )}
    </details>
  );
}

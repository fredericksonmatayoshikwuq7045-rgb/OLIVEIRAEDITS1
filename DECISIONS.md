# Decisões da versão 2

## Revisão do plano antes da implementação

1. **Preservação primeiro.** Os dados legados permanecem intocados. A migração
   guarda valores brutos, campos desconhecidos e mídia recuperável; itens sem
   arquivo exigem re-vinculação. Recuperação de erro nunca apaga dados.
2. **Contratos antes da interface.** Modelo versionado, RenderSpec normalizado
   e jobs tipados são a fronteira entre dados, editor e motor. Coordenadas não
   dependem da altura do painel. A geometria calculada acompanha o job.
3. **Ordem de camadas real.** Um único PNG não representa camadas dos dois lados
   do vídeo. Usar planos estáticos ordenados, preservando zIndex e transparência.
4. **Núcleo Rust testável sem janela.** Exportação usa workers e processos reais;
   a integração Tauri fica no recurso `desktop`. Testes do núcleo não precisam
   de servidor gráfico, mas não substituem a validação do aplicativo desktop.
5. **Cancelamento e pausa distintos.** Pausar impede novos itens; cancelar
   encerra o processo ativo e elimina saída parcial. Não simular suspensão
   portátil de FFmpeg nem anunciar encerramento como sucesso.
6. **Metadados: verificar, sem prometer anonimato.** Comparar tags antes/depois,
   destacar remanescentes sensíveis e preservar originais por padrão. Não
   prometer evitar reconhecimento do conteúdo nem impedir reencode por redes.
7. **Windows é uma validação própria.** Testes Linux e build web não demonstram
   que um instalador Windows funciona. Preparar sidecars com verificação de
   integridade e registrar os checks realmente executados em REPORT.md.
8. **Entrega honesta.** Funções opcionais indisponíveis recebem estado explícito
   e pendência. Métricas vêm de FFmpeg/arquivos; hardware encoder exige tentativa
   real e fallback. Não atribuir capacidade de hardware só à lista de encoders.

O mapeamento inicial foi feito sobre todos os arquivos-fonte. O build web
original passa. Rust e bibliotecas de desenvolvimento Tauri ainda precisam
ser preparados para estabelecer a linha de base nativa.

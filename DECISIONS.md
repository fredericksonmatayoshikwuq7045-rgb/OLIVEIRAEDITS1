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

9. **Efeitos constantes calculados uma vez.** Gradiente e máscara circular são
   rasterizados em PNG por item no cache privado, antes do FFmpeg. Calcular
   `geq` a cada frame em Full HD tornou a retomada desnecessariamente lenta.
   O alfa da origem é multiplicado pela máscara; os PNGs são removidos pelo guard.
10. **Sair espera a limpeza.** A confirmação de fechamento cancela a fila,
    aguarda os workers e persiste o snapshot antes de encerrar. Se o limite de
    espera for excedido, mantém a janela aberta com erro acionável.
11. **Critérios verificáveis.** H.264/AAC, yuv420p e faststart são verificáveis;
    uma rede social ainda pode reprocessar o upload. Preview/export compartilham
    geometria e composição, mas compressão e renderizadores impedem prometer
    identidade de pixels: a comparação real tem tolerância documentada.
12. **Escopo do acabamento.** Interface permanece em pt-BR e tema escuro.
    Biblioteca global, intro/outro e ponto focal automático/manual são opcionais
    do plano e ficam registrados em PENDING.md, sem controles inoperantes.

O mapeamento inicial foi feito sobre todos os arquivos-fonte. O build web
original passou; o check Rust inicial estava indisponível por ausência da
toolchain e dos pacotes GTK/WebKit. Ambos foram preparados na nuvem sem alterar
o sistema global. O núcleo, a compilação desktop Linux e a janela Tauri real
foram validados ao final, conforme REPORT.md.

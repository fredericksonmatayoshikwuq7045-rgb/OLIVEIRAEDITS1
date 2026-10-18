# Oliveira Edits 0.4.0 — camadas e alas de edição

## Todas as camadas na timeline

Borda, marca, imagem/vídeo de headline, texto e fundo aparecem em faixas próprias.
Um template de headline pode gerar duas faixas, uma visual e outra de texto,
para permitir tempos independentes. O fundo mantém seus controles de áudio e
repetição. Mesmo um fundo sólido tem faixa; fora de sua janela aparece o fundo
neutro do projeto.

Selecione uma faixa, arraste o corpo para mudar seu momento ou as pontas para
ajustar início/fim. Os campos **Aparecer em (s)** e **Desaparecer em (s)** aceitam
valores exatos. Cada gesto e cada confirmação numérica geram uma ação de
histórico. As setas ajustam um quadro; Shift multiplica o passo por dez.
**Usar durante todo o trecho** restaura a duração completa. O olho oculta a
camada, e a lixeira remove a camada ou restaura o fundo sólido.

Os tempos pertencem à **saída editada**, começando em zero depois do corte e da
velocidade. Exemplo: origem de 10 a 20 segundos a 2× produz 5 segundos de saída;
uma marca de 1 a 3 aparece nesse intervalo da saída. A divisão do vídeo desloca
as janelas e preserva a fase dos templates animados no segundo trecho.

A timeline começa compacta para preservar o player. Use **Expandir timeline**
para trabalhar com várias camadas; a região tem rolagem. Os layouts anteriores,
alças do player, menu contextual e controles de enquadramento continuam disponíveis.

## Templates em vídeo

Em qualquer categoria da biblioteca, escolha **Template em vídeo** antes de
adicionar o arquivo. As opções imagem e imagem/vídeo também continuam disponíveis.
O app identifica tipo, dimensões e duração do arquivo; no desktop usa FFprobe.
O arquivo vira um asset do perfil e entra no backup `.oeprofile`.

Na faixa de um vídeo, **Começar no segundo do template** escolhe o ponto de
entrada, e **Repetir vídeo na camada** controla a repetição. Com repetição
desativada, o último quadro permanece até o fim da faixa. Duas ocorrências do
mesmo arquivo têm relógios independentes. Prévia, PNG e MP4 usam a mesma janela,
ponto de entrada e política de repetição.

Templates de sobreposição permanecem sem áudio. O fundo em vídeo preserva sua
opção de misturar áudio; o áudio do fundo respeita o início/fim e o ponto de
entrada, com silêncio fora da janela. Não há faixas independentes de edição de
áudio nesta versão. O suporte de decodificação/transparência depende do codec e
do WebView do sistema; o teste usa MP4 H.264.

## Ala de imagens

A navegação **Todas / Vídeos / Imagens** organiza o mesmo projeto. A ala de
imagens mantém enquadramento, corte, rotação, camadas, texto, biblioteca, assistente,
lote, histórico e exportação. A opção **Todas** continua disponível. Trocar de
ala não remove mídias; **Limpar todas** continua limpando a leva inteira do
projeto, e a confirmação informa que inclui as duas alas.

Na edição de um template, marque **Disponível nas alas de vídeos e imagens**
para compartilhá-lo entre as alas. As contas continuam isoladas. Sem essa opção,
o filtro de compatibilidade anterior por tipo de mídia é preservado.

Uma foto com template animado tem composição temporal: escolha a duração e o
**Momento da imagem exportada (s)**, ou reproduza e pause para escolher um quadro.
A saída continua sendo **PNG, JPG ou WebP estático**, no momento salvo. A função
não transforma uma foto automaticamente em MP4. O momento escolhido permanece no
projeto e no backup. A duração padrão é de pelo menos cinco segundos, estendida
pelas camadas; pode ser definida explicitamente.

## Compatibilidade e correções

O formato de dados continua v2, com campos opcionais. Projetos existentes sem
janela usam toda a duração, vídeos de template repetem por padrão e imagens
exportam o quadro zero. Backups preservam os novos campos e validam valores.
Use a versão atual para reabrir backups criados com os novos recursos.

A validação corrigiu um relógio de imagem que podia prender a reprodução, ajustou
o espaço da timeline para manter o gesto de pinça e tornou `mediaUrl` idempotente:
um endereço `asset://` pronto não é convertido novamente. Isso corrige a abertura
da prévia e a exportação de imagens no desktop Linux. O WebKit Linux lê vídeos por streaming em loopback, com
tokens aleatórios, autorização nativa de caminho e suporte a intervalos de bytes;
isso mantém a busca de quadros sem copiar vídeos inteiros para a memória. Os
demais sistemas mantêm o protocolo de assets do Tauri. A inicialização Linux
mantém os quadros das camadas sem áudio disponíveis ao Canvas e usa playbin3.
A exportação também resolve o caminho de um template recém-importado sem exigir
reabrir o perfil; URLs temporárias continuam fora dos backups.

## Verificação em 18/10/2026

- 119 testes frontend/dados e 41 testes Rust aprovados; TypeScript, ESLint,
  Prettier, limite de 300 linhas e build de produção desktop Linux aprovados.
- Interface Chromium: todas as categorias na timeline, arraste/desfazer, tempos,
  offsets independentes, repetição, ala de imagens, PNGs reais em dois momentos,
  reprodução, persistência e roundtrip de backup.
- Seis composições temporais, 28 quadros comparados entre Canvas e FFmpeg, mais
  análise do áudio do fundo antes/dentro/depois da janela. Inclui corte/velocidade,
  vídeo sem repetição, gradiente, imagem de fundo e fundo blur oculto.
- Regressões: 20 exports reais e erros/cancelamento, nove casos de equivalência
  visual, importação de 501 arquivos, migração, aparência e limpeza da leva.
- Bundle de produção no WebKit Linux: importação `File` e probe reais, prévia
  temporal, autorização/ranges, MP4 e PNG produzidos pela interface e verificados
  por pixels. A execução usa o ambiente headless em software documentado.
- Núcleo e testes compilados para Windows MSVC. Isso não substitui execução do
  aplicativo e do instalador NSIS em Windows/WebView2, que permanece pendente.

Evidências e escopo: [resumo](validation/layers-summary-2026-10-18.json).
Para atualizar, baixe `refactor/v2`, rode `npm ci`, prepare os sidecars conforme
[README](../README.md) e gere um novo instalador. O executável já instalado não
é atualizado pela simples extração do código.

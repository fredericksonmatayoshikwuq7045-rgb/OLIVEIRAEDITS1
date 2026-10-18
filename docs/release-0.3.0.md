# Oliveira Edits 0.3.0 — estúdio e assistentes locais

Entrega: 17/10/2026, branch `refactor/v2`. Executado em Linux x86_64.

## O que mudou e como usar

1. **Entrada e perfil.** Crie/edite uma conta, escolha uma foto PNG/JPG/WebP,
   ajuste posição/zoom e confirme **Usar esta foto** antes de salvar. O recorte
   visto na tela é o arquivo salvo. Foto e referências acompanham o `.oeprofile`.
2. **Frase do dia.** A seleção de perfis mostra um painel e, ao entrar na conta,
   uma faixa discreta que pode ser ocultada pelo dia. Em **Personalizar estúdio →
   Frases**, escolha pt-BR, inglês ou espanhol, autor e seus próprios textos.
   A escolha usa o dia local do computador e permanece estável ao reabrir.
3. **Personalização.** O botão de paleta no topo abre temas claro/escuro/sistema,
   cor, fonte, tamanho do texto, animação Matrix e desempenho. Contraste do texto
   se adapta a cores de destaque claras/escuras. A animação é desenhada localmente
   só na seleção de perfis; respeita movimento reduzido e pausa com a aba oculta.
4. **Organização.** Escolha player central com slots abaixo, player à direita
   com slots no centro ou modo foco. Arraste as divisórias laterais; elas também
   respondem às setas quando recebem foco. Há restauração do layout padrão.
5. **Edição pelo mouse.** Arraste a mídia, use as oito alças para redimensionar
   e o ponto externo para girar. Na etapa de templates/texto, clique na camada
   para selecionar e transformar. Cada gesto concluído gera uma ação de desfazer.
   **Ver original / Ver edição** facilita a conferência do resultado.
6. **Botão direito.** Nos slots ou no player, abra as ações para exportar um
   item, duplicar, re-vincular, remover do projeto ou copiar edição. Escolha os
   grupos a copiar (enquadramento, camadas, fundo, corte/velocidade) e o destino.
   Remover do projeto preserva o arquivo original e admite desfazer.
7. **Timeline.** Vídeos mostram oito quadros do original. Mova o cursor, arraste
   as pontas do corte ou use os campos numéricos. **Dividir no cursor (S)** cria
   dois slots com trims independentes, compartilhando o mesmo arquivo original.
   Não é uma timeline de montagem multifaixa; cada slot é exportado separadamente.
8. **Recorte de cena em lote.** Selecione mídias, abra **Assistente em lote** e
   analise **Área real da mídia**. O detector procura a faixa dominante de cena,
   ignorando títulos isolados sobre a moldura preta. Revise as caixas, escolha
   mostrar a cena inteira ou preencher e aplique somente os resultados desejados.
9. **Cobrir marcas em lote.** No assistente, escolha **Localizar marca antiga**.
   Digite o texto (três letras/números ou mais) ou forneça uma imagem bem recortada
   da marca. Informe sua marca em texto ou importe/escolha sua logo, ajuste fundo
   e margem, analise e revise cada arquivo. A regra fica salva na conta. Uma placa
   opaca cobre inclusive os espaços transparentes da logo; placa e marca viram
   camadas normais que você pode ajustar depois.
10. **Conferência e desempenho.** A exportação verifica os itens prontos, cortes,
    dimensões e referências antes de iniciar. O modo de desempenho desliga
    animação e extração dos quadros da timeline. O grid continua virtualizado.

## Frases e limites da análise

O catálogo inicial tem nove textos: Bíblia, Schopenhauer, Edison, Musk,
Zuckerberg, Goggins e uma reflexão original. A origem bibliográfica aparece em
**Sobre a frase**; traduções livres são identificadas. É um catálogo local,
sem geração por IA, atualização diária pela internet ou promessa de texto
inédito. Um autor com um único texto repete esse texto. Ilia Topuria está no
filtro para frases pessoais; não foi preenchido com uma atribuição inventada.
A referência bibliográfica não significa verificação online nesta execução.

O assistente roda localmente. Vídeos usam até cinco quadros do trecho selecionado;
marcas em posições diferentes entre arquivos recebem caixas independentes.
A análise **não rastreia uma marca continuamente dentro de um vídeo**. Movimento,
texto muito pequeno/transparente, múltiplas ocorrências, mudanças de moldura e
referências visuais muito diferentes reduzem a confiança. Resultados incertos
ficam desmarcados para revisão. Confira o vídeo antes de exportar e ajuste as
camadas quando necessário. Nenhuma parte da imagem é reconstruída por IA.

## Dados, instalação e privacidade

O formato dos perfis continua v2, com campos novos opcionais. Contas antigas são
aceitas e a migração preserva o legado. Foto, logo e referência visual pertencem
à conta e entram no `.oeprofile`; importação/duplicação remapeia seus IDs.
Preferências de interface e frases pessoais são globais e locais ao dispositivo,
em `oe_ui_v2`; não são parte do backup de um perfil. Vídeos externos continuam
por caminho e podem exigir re-vínculo ao mudar de computador.

`npm ci` executa `setup-vision.mjs`, que prepara worker/WebAssembly e os três
idiomas do OCR, com suas licenças, a partir de dependências fixadas no lockfile.
São cerca de 36 MB locais em `public/vision`, ignorados pelo Git e copiados para
o bundle pelo Vite. Use `npm run setup:vision` para preparar novamente se faltar.
Não é preciso internet para a análise depois da instalação. As mídias e os
textos da marca não são enviados a um serviço de OCR externo.

Para atualizar, faça backup dos perfis, obtenha a branch `refactor/v2` em uma
pasta nova e siga a seção **Instalador Windows** do [README](../README.md).
`npm ci`, preparação dos sidecars e `npm run tauri build -- --bundles nsis`
geram o novo instalador em Windows. O executável instalado anteriormente não
se atualiza sozinho. A versão de app/package/Cargo desta entrega é 0.3.0.

## Validação executada

| Verificação | Evidência nesta rodada |
| --- | --- |
| Frontend/dados | 105 testes em 18 arquivos aprovados |
| Rust | 36 testes do núcleo aprovados; check dos testes para Windows MSVC aprovado |
| Qualidade/build | TypeScript, Vite, ESLint, Prettier, limite de 300 linhas e CLI Tauri aprovados |
| Instalação reproduzida | Script completo reexecutado com `npm ci`, OCR local, sidecars, checks e build desktop Linux |
| Editor no Chromium | 7 verificações: foto, personalização, layouts, transformações/histórico, filmstrip/trim/split, recorte, OCR e PNG |
| Bundle web de produção | As mesmas 7 verificações passaram com Vite preview, sem HMR |
| Aparência | 2 verificações: contraste, cores branca/preta, fontes, 1100px, divisórias, tema do sistema e movimento reduzido |
| Referência e backup | 2 verificações reais: worker encontra a marca em posições diferentes; `.oeprofile` preserva/remapeia foto, referências, logo e edição |
| Desktop de produção | 3 verificações em `tauri://localhost`: amostragem real com escopos, OCR offline no WebKit empacotado e exportação H.264 pela UI com cobertura no frame |
| Regressões anteriores | Importação de pasta com 501 imagens, migração real e relatório/retry de exportação aprovados |
| Motor FFmpeg | 20 exports reais e casos de erro, permissões, originais, metadados, loop e cancelamento aprovados |
| Dependências JavaScript | `npm audit`: zero vulnerabilidades reportadas |

Foram corrigidas falhas encontradas durante os testes: alça de imagem que
modificava a mídia, busca visual que perdia posições entre passos da grade,
binarização de OCR que descartava texto em placas, confirmação da foto antes
de salvar, criação de conta parcialmente salva, contraste do tema claro,
escala das fontes e fechamento do menu de contas. O cache nativo de frames usa
arquivos parciais únicos e troca atômica para evitar colisões concorrentes.

Relatórios: [validation](validation/), arquivos `studio-*`. As entradas de teste
são sintéticas. As comparações visuais e o fechamento nativo da base 0.2.0 estão
no [relatório histórico](../REPORT.md). Esta nuvem não gerou nem executou NSIS ou
WebView2 Windows. Instalação Windows, hardware de GPU e marcas reais em toda
condição continuam sujeitos aos limites em [PENDING](../PENDING.md). O erro
Windows de acesso negado a `link.exe`/`rustc.exe` depende das permissões e políticas
da máquina; esta atualização não altera essa política do computador.

# OvelhaoHb Idles Hub

Um hub desktop privado para reunir jogos idle de navegador em uma única aplicação. Ele mantém cada jogo em uma sessão isolada, preserva logins localmente e oferece recursos para acompanhar a rotina de jogo sem abrir várias janelas do navegador.

## Recursos

- Sessões persistentes e isoladas por jogo.
- Credenciais protegidas pelo cofre do sistema operacional.
- Controle de som, zoom, favoritos, busca e atalhos entre jogos.
- Lembretes recorrentes com notificações nativas do sistema.
- Notas locais para estratégias, metas, links e checklists de cada jogo.
- Perfil por jogo para manter a atividade em segundo plano ou economizar recursos.
- Diagnóstico de processo e consumo de memória dos jogos carregados.
- Recuperação limitada de processos que pararem inesperadamente.

## Privacidade

URLs, preferências, lembretes e notas ficam no perfil local do aplicativo. Usuários e senhas usam a proteção fornecida pelo sistema operacional. Cada jogo tem seu próprio armazenamento de cookies e sessão.

Para acompanhar instalações e melhorar o produto, a versão distribuída envia ao PostHog eventos anônimos de uso: abertura e fechamento do hub, versão, sistema operacional, arquitetura e uso de recursos. Não enviamos identificação pessoal, endereços dos jogos, credenciais, cookies, notas, lembretes, nomes de jogos ou links.

## Instalação

Baixe a versão mais recente na página de [Releases](https://github.com/ovelhaohb/ovelhaohb-hub-idle/releases).

### Windows

Baixe **`OvelhaoHb Idles Hub Setup x.y.z.exe`** para instalar o hub. Esse formato recebe avisos de atualização dentro do próprio aplicativo. Execute o instalador e mantenha a mesma pasta usada pela versão anterior quando estiver atualizando.

Para usar sem instalação, baixe **`OvelhaoHb Idles Hub x.y.z.exe`**. A versão portátil não se atualiza automaticamente: substitua o arquivo manualmente ao baixar uma versão nova.

### Linux

Baixe o arquivo **`.AppImage`**, marque-o como executável e abra-o:

```bash
chmod +x OvelhaoHb-Idles-Hub-*.AppImage
./OvelhaoHb-Idles-Hub-*.AppImage
```

### macOS

Baixe o arquivo **`.dmg`**, abra-o e arraste o hub para a pasta **Applications**. Em Macs com Apple Silicon, prefira o arquivo com `arm64` no nome; em Macs Intel, use o pacote sem esse sufixo.

## Uso

1. Instale as dependências com `npm install`.
2. Execute `npm start`.
3. Adicione um jogo, informe o endereço e, se desejar, salve as credenciais para preenchimento manual ou automático.

Atalhos úteis: `Ctrl+Tab` e `Ctrl+Shift+Tab` trocam de jogo; `Ctrl` + `+`, `Ctrl` + `-` e `Ctrl` + `0` ajustam o zoom. Fechar a janela mantém o hub ativo na bandeja do sistema; use **Sair** no menu da bandeja para encerrar completamente.

## Desenvolvimento

O VS Code recomenda ESLint, Prettier, Error Lens, Code Spell Checker e GitLens ao abrir o projeto. Pressione `F5` ou use a tarefa **Abrir OvelhaoHb Idles Hub** para executar o código-fonte.

Para gerar um pacote local, execute `npm run dist`.

## Releases

As releases oficiais são criadas pelo GitHub Actions ao publicar uma tag no formato `v*`. O fluxo gera artefatos nativos para Windows, Linux e macOS e os anexa à release correspondente no GitHub.

A versão em uso aparece no rodapé da barra lateral. Toda atualização publicada incrementa a versão do aplicativo e recebe uma tag correspondente no GitHub.

Os backups de desenvolvimento são mantidos fora do repositório para não incluir dados pessoais ou arquivos de sessão no histórico do projeto.

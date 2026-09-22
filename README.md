# OvelhaoHb Idles Hub

Um hub desktop leve para organizar e jogar jogos idle de navegador. Cada jogo usa uma sessão de navegador persistente e isolada; os dados de acesso são armazenados localmente e criptografados pelo cofre do sistema operacional.

## Desempenho e continuidade

- Os timers dos jogos continuam ativos quando a janela está minimizada ou coberta.
- As páginas só são carregadas quando o jogo é aberto pela primeira vez na sessão.
- Cache em disco limitado a 96 MB e cache de mídia limitado a 32 MB por contexto Chromium.
- Limpeza preventiva de cache a cada sete dias, sem apagar cookies ou logins.
- Recuperação automática de processos de jogo que travarem, limitada para evitar loops.
- Bandeja do Windows: fechar a janela mantém o hub e os jogos ativos; use **Sair** no ícone da bandeja para encerrar.
- A janela, o zoom e os favoritos de cada jogo são restaurados localmente.

## Atalhos e biblioteca

- `Ctrl+Tab` e `Ctrl+Shift+Tab`: avançar ou voltar entre os jogos.
- `Ctrl` + `+`, `Ctrl` + `-` e `Ctrl` + `0`: ajustar ou restaurar o zoom do jogo ativo.
- Use a busca da barra lateral e a estrela na barra do jogo para organizar os favoritos.
- Ao remover um jogo, a sessão fica preservada por padrão. A exclusão dos cookies e dados locais exige confirmação separada.

## Cópias de segurança

- Antes de cada atualização de desenvolvimento, as cópias do projeto são criadas em `D:\ProjetosVS\Drakoria Tab Backups`.
- O arquivo de biblioteca do aplicativo mantém uma cópia `games.json.bak` antes de cada gravação.

## VS Code

Ao abrir esta pasta, o VS Code sugere ESLint, Prettier, Error Lens, Code Spell Checker e GitLens. As recomendações ficam em `.vscode/extensions.json`; a formatação ao salvar fica em `.vscode/settings.json`.

## Executar

```powershell
npm.cmd install
npm.cmd start
```

### Abrir diretamente pelo VS Code

1. Abra esta pasta no VS Code.
2. Pressione `Ctrl+Shift+B`.
3. Escolha **Abrir OvelhaoHb Idles Hub**.

Também é possível pressionar `F5` e selecionar **Abrir OvelhaoHb Idles Hub** na área **Executar e Depurar**. Isso executa o código-fonte com o Electron oficial das dependências, sem instalar o aplicativo e sem criar uma exclusão no Windows Defender.

## Gerar instalador para Windows

```powershell
npm.cmd run dist
```

O instalador será criado na pasta `release`.

O mesmo comando também gera uma versão portátil em um único arquivo `.exe`. Ela pode ser executada diretamente, sem instalação.

## Privacidade

- URLs, nomes e cores ficam no arquivo local de configuração do aplicativo.
- Usuário e senha são criptografados com `safeStorage` do Electron (DPAPI no Windows).
- Cada jogo recebe sua própria partição persistente para cookies e armazenamento da sessão.
- Nenhum dado é enviado a um servidor do OvelhaoHb Idles Hub.

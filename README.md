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

O hub não envia dados a servidores próprios. URLs, preferências, lembretes e notas ficam no perfil local do aplicativo. Usuários e senhas usam a proteção fornecida pelo sistema operacional. Cada jogo tem seu próprio armazenamento de cookies e sessão.

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

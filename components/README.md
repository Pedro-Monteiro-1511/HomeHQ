# Estrutura dos componentes

- `app/`: sessão, tema e composição raiz.
- `auth/`: perfil e fluxos de autenticação.
- `dashboard/`: página inicial, seleção e criação de casas.
- `house/`: layout e páginas funcionais de cada casa.
- `shared/`: componentes reutilizáveis.

Cada página funcional vive num ficheiro próprio. Componentes pequenos que
existem apenas dentro de uma página podem permanecer privados nesse módulo.
Tipos partilhados vivem em `types/homehq.ts` e funções sem estado em
`lib/homehq-utils.ts`.

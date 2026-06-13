# Configurar a base de dados HomeHQ

1. Abre o projeto no painel do Supabase.
2. Entra em **SQL Editor** e cria uma nova query.
3. Copia todo o conteúdo das migrações por ordem numérica.
4. Executa cada migração uma única vez.

A migração cria:

- perfis privados e perfis públicos sem exposição do email;
- casas e membros, incluindo a data de entrada;
- moeda e fuso horário configuráveis por casa;
- contas da casa e divisão de valores por membro;
- ordenação das contas pela próxima data de pagamento;
- tarefas com vários responsáveis e preferências individuais de notificação;
- gestão de membros e convites por email ou QR code;
- convites pendentes com aceitação ou rejeição na página inicial;
- permissões extensíveis por secção com níveis editar, somente ver e sem acesso;
- compras concluídas com comprador e divisão personalizada;
- aparência partilhada por casa com paletas predefinidas;
- pedidos para entrar em casas adicionais;
- convites exclusivos por email;
- convites por QR code com limite de utilizações;
- limite normal de uma casa por utilizador;
- exceção de limite para utilizadores privilegiados;
- bucket público para fotos de perfil;
- regras de segurança e funções para criar casas e aceitar convites.

Para tornar um utilizador privilegiado no futuro, altera `is_privileged` através de um backend seguro com a service role. Nunca coloques a service role na aplicação.

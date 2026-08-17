# CompEx

## Projeto

Sistema web da Atlética CompExatas para gerenciamento de sócios, carteirinhas, eventos, agenda, planos e área administrativa.

O projeto deve manter uma identidade visual consistente em todas as telas.

## Regras de desenvolvimento

- Trabalhe somente no escopo solicitado.
- Faça a menor alteração necessária.
- Não faça refatorações fora do card.
- Não altere funcionalidades existentes sem necessidade.
- Reutilize componentes existentes antes de criar novos.
- Antes de criar uma nova implementação, procure se já existe componente, serviço ou padrão equivalente.
- Não explore o repositório inteiro sem necessidade.

## Interface e identidade visual

- Todas as páginas devem seguir o mesmo design system.
- Não criar estilos isolados para cada página.
- Reutilizar componentes de:
  - botões
  - inputs
  - cards
  - modais
  - navegação
  - cabeçalhos
  - estados vazios
  - badges
  - tabelas

- Manter consistência de:
  - cores
  - tipografia
  - espaçamentos
  - bordas
  - sombras
  - ícones
  - hierarquia visual

- O lobo é o principal elemento/mascote visual da CompExatas.
- Não introduzir estrelas ou elementos visuais aleatórios que não façam parte da identidade.
- Evitar aparência genérica de template ou interface produzida por IA.
- Priorizar interface moderna, esportiva, universitária e profissional.
- As telas internas devem parecer parte do mesmo produto que a Home.

## Responsividade

- Toda alteração visual deve funcionar em desktop e mobile.
- Não corrigir desktop quebrando mobile ou vice-versa.
- Evitar valores fixos desnecessários que prejudiquem responsividade.

## Áreas principais

O sistema pode possuir áreas como:

- Home
- Login
- Cadastro de sócio
- Perfil do sócio
- Carteirinha digital
- Eventos
- Agenda
- Planos
- Área administrativa
- Gestão de associados

Ao alterar uma dessas áreas, preserve os padrões utilizados nas demais.

## Dados e regras de negócio

- Não alterar regras de planos ou associação sem solicitação explícita.
- Não remover dados ou funcionalidades existentes sem necessidade.
- Não criar dados mockados permanentes quando já existir fonte de dados real.
- Não alterar banco de dados ou migrations destrutivamente sem autorização.

## Segurança

- Não expor credenciais, tokens ou secrets.
- Não modificar arquivos de ambiente contendo secrets sem necessidade.
- Não executar operações destrutivas em banco ou infraestrutura sem autorização.

## Validação

Após alterações, execute somente as validações relevantes ao que foi modificado.

Quando aplicável:

1. typecheck
2. lint
3. testes relacionados
4. build quando necessário

Não execute suites completas repetidamente se uma validação direcionada for suficiente.

## Alterações de UI

Ao receber pedido para melhorar uma tela:

1. primeiro identifique os componentes e padrões já usados na Home e nas telas aprovadas;
2. reutilize esses padrões;
3. altere somente a tela solicitada e componentes compartilhados realmente necessários;
4. não redesenhe outras páginas sem solicitação;
5. preserve funcionalidades existentes.

## Conclusão

Ao finalizar uma tarefa, informe somente:

1. o que foi alterado;
2. arquivos modificados;
3. validações executadas;
4. resultado;
5. pendências reais.
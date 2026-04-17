# Project Modules Guide

## Objetivo

Este documento existe para acelerar manutencao no projeto.
Use este guia quando precisar:

- criar uma funcao nova
- alterar uma funcao existente
- descobrir em qual modulo uma regra mora
- entender quais modulos costumam andar juntos

O foco aqui nao e documentacao teorica. O foco e manutencao rapida.

## Stack e Base Tecnica

- Framework: NestJS
- Linguagem: TypeScript
- ORM: Prisma
- Banco: PostgreSQL
- Auth: JWT
- E-mail: Nodemailer via `MailService`
- Validacao: `class-validator` e `class-transformer`
- Documentacao de rotas: Swagger decorators

Arquivos base:

- `src/app.module.ts`: ponto central de composicao dos modulos
- `prisma/schema.prisma`: modelo de dados principal
- `src/prisma/prisma.service.ts`: client Prisma compartilhado
- `src/common/*`: guard, decorators, audit e utilitarios transversais

## Como o Projeto Esta Organizado

O padrao principal do projeto e:

- `*.module.ts`: registra controllers, services, imports e exports
- `*.controller.ts`: recebe HTTP, valida DTO, injeta usuario atual e delega
- `*.service.ts`: regra de negocio e acesso ao Prisma
- `dto/`: contratos de entrada e saida
- `types/`: tipos internos usados no modulo
- `README.md`: alguns modulos ja possuem um README local, mas varios ainda estao placeholder

Padrao mental importante:

1. `controller` deve ser fino
2. `service` concentra regra
3. regra reutilizavel ou fluxo grande merece service separado
4. persistencia quase sempre fica no proprio service via Prisma
5. mudancas com impacto em mapa, financeiro, contrato ou e-mail normalmente geram efeitos colaterais fora do arquivo inicial

## Fluxo Tipico de Uma Requisicao

Fluxo mais comum:

1. rota entra em um `controller`
2. `DTO` valida payload
3. `controller` chama `service`
4. `service` consulta ou altera dados via `PrismaService`
5. opcionalmente chama outros services do mesmo modulo ou modulo importado
6. opcionalmente registra `AuditLog`
7. opcionalmente envia e-mail com `MailService`
8. resposta volta para o front

## Infraestrutura Transversal

### Auth global

- O projeto usa `JwtAuthGuard` global em `src/app.module.ts`
- Por padrao, toda rota exige JWT
- Rotas publicas precisam de `@Public()`
- Arquivos importantes:
  - `src/common/guards/jwt-auth.guard.ts`
  - `src/common/decorators/public.decorator.ts`
  - `src/common/decorators/current-user.decorator.ts`

### Prisma

- `PrismaModule` e global
- `PrismaService` conecta no bootstrap e desconecta no shutdown
- Toda mudanca de modelo passa primeiro por `prisma/schema.prisma`
- Quando a regra e multi-etapas, prefira `prisma.$transaction(...)`

### Audit

- Existe `AuditService` em `src/common/audit/audit.service.ts`
- Use quando a alteracao precisa de trilha de auditoria atomica
- Se a mudanca e feita dentro de transaction, o ideal e logar usando o `tx`

### Mail

- `MailModule` e global
- `MailService` mora em `src/modules/mail/mail.service.ts`
- Qualquer modulo pode disparar e-mail via DI
- Se o fluxo depende do envio para sucesso operacional, trate falha explicitamente

## Mapa Rapido dos Modulos

### 1. Acesso, usuarios e identidade

#### `user`

- Caminho: `src/modules/user`
- Rota base: `users`
- Responsabilidade: operacoes de usuario interno
- Toque aqui quando:
  - precisar buscar ou atualizar usuario admin
  - o login interno depender de dados do usuario

#### `auth`

- Caminho: `src/modules/auth`
- Rota base: `auth`
- Responsabilidade: autenticacao JWT do lado admin/interno
- Toque aqui quando:
  - mudar login admin
  - alterar emissao de token JWT
  - mudar regra de autenticacao do backoffice

#### `exhibitor-auth`

- Caminho: `src/modules/exhibitor-auth`
- Rota base: `exhibitor-auth`
- Responsabilidade: autenticacao do expositor
- Toque aqui quando:
  - mudar login do expositor
  - alterar fluxo de senha, token ou validacao publica do expositor

#### `owners`

- Caminho: `src/modules/owners`
- Rota base: `owners`
- Responsabilidade: cadastro do expositor/responsavel
- Toque aqui quando:
  - precisar alterar dados cadastrais do expositor
  - uma regra depende de `Owner`, documento, email, telefone, endereco

### 2. Feiras, interessados e jornada comercial

#### `fairs`

- Caminho: `src/modules/fairs`
- Rota base: `fairs`
- Responsabilidade: cadastro e gestao da feira
- Toque aqui quando:
  - criar ou editar feira
  - mexer em ocorrencias, periodos ou metadados principais
- Dependencias frequentes:
  - `fair-maps`
  - `fair-showcase`
  - `interest-fairs`
  - `owner-fair-purchase`
  - `contracts`

#### `interests`

- Caminho: `src/modules/interests`
- Rota base: `interests`
- Responsabilidade: gestao do lead/interesse comercial
- Toque aqui quando:
  - houver mudanca no pipeline inicial do interessado
  - o fluxo comecar em lead antes de virar expositor em feira

#### `interest-fairs`

- Caminho: `src/modules/interest-fairs`
- Rota base: `interests/:id/fairs`
- Responsabilidade: converter interesse em vinculo do expositor com a feira
- Toque aqui quando:
  - o expositor entra oficialmente na feira
  - a regra envolve compra, parcelas, contrato, barraca ou status do expositor na feira
- Este e um dos modulos mais sensiveis do sistema
- Frequentemente cruza com:
  - `owner-fair-purchase`
  - `contracts`
  - `stalls`
  - `magic-links`

#### `exhibitor-fairs`

- Caminho: `src/modules/exhibitor-fairs`
- Rota base: `exhibitor/fairs`
- Responsabilidade: visao do expositor dentro das feiras onde ele participa
- Toque aqui quando:
  - o expositor precisa consultar ou operar dados da propria participacao

#### `stalls`

- Caminho: `src/modules/stalls`
- Rota base: `stalls`
- Responsabilidade: barracas do expositor
- Toque aqui quando:
  - mudar cadastro da barraca
  - alterar vinculo da barraca com feira ou slot
  - o tamanho ou tipo da barraca impactar regra de marketplace

### 3. Mapas, vitrine publica e espacos

#### `map-templates`

- Caminho: `src/modules/map-templates`
- Rota base: `map-templates`
- Responsabilidade: templates de planta/mapa
- Toque aqui quando:
  - alterar estrutura base do mapa
  - mudar definicao de elementos de planta reutilizavel

#### `fair-maps`

- Caminho: `src/modules/fair-maps`
- Rota base: `fairs/:fairId/map`
- Responsabilidade: mapa concreto da feira, slots e vinculos com barracas
- Toque aqui quando:
  - o comportamento visual ou comercial do slot mudar
  - o status do slot precisar sincronizar com reserva, confirmacao ou expiracao
  - houver ligacao fisica entre slot e barraca
- Cruzamento muito comum:
  - `marketplace`
  - `stalls`
  - `fairs`

#### `fair-showcase`

- Caminho: `src/modules/fair-showcase`
- Rota base: `fair-showcase`
- Responsabilidade: vitrine publica/editorial da feira
- Toque aqui quando:
  - mudar conteudo publico da feira
  - o site ou listagem publica precisar de dados editoriais

### 4. Marketplace

#### `marketplace`

- Caminho: `src/modules/marketplace`
- Rotas base:
  - `marketplace`
  - `admin/marketplace`
- Responsabilidade:
  - interesse em slot
  - reserva de slot
  - confirmacao da reserva
  - expiracao
  - notificacoes de e-mail ligadas ao fluxo
- Este modulo ja esta mais componentizado do que outros
- Arquivos internos importantes:
  - `marketplace.service.ts`: fluxo principal publico
  - `admin-marketplace.service.ts`: operacoes do admin
  - `marketplace-expiration.service.ts`: expiracao de reservas/interesses
  - `marketplace-reservation-confirmation.service.ts`: conversao da reserva em vinculo real
  - `marketplace-missing-stall-notification.service.ts`: alerta de slot confirmado sem barraca
- Toque aqui quando:
  - a regra nasce no mapa comercial
  - o expositor interage com slot
  - o admin confirma ou ajusta reserva
  - houver e-mail operacional do marketplace
- Dependencias frequentes:
  - `fair-maps`
  - `stalls`
  - `owners`
  - `interest-fairs`
  - `mail`

#### `public/marketplace`

- Caminho: `src/modules/public/marketplace`
- Rota base: `public/marketplace`
- Responsabilidade: leitura publica do marketplace
- Toque aqui quando:
  - o front publico precisa consultar slots, feira ou vitrine de marketplace

### 5. Contratos, financeiro e acessos especiais

#### `owner-fair-purchase`

- Caminho: `src/modules/owner-fair-purchase`
- Rota base: `fairs`
- Responsabilidade: compras financeiras do expositor na feira
- Toque aqui quando:
  - houver parcelas
  - status financeiro precisar ser recalculado
  - for necessario criar, listar ou atualizar pagamentos do expositor
- Geralmente anda junto com:
  - `interest-fairs`
  - `contracts`

#### `contracts`

- Caminho: `src/modules/contracts`
- Rotas base principais:
  - `document-templates`
  - `contracts`
  - `contracts/assinafy`
  - `fairs/:fairId/contract-settings`
- Responsabilidade:
  - templates de documentos
  - arquivos e integracao com assinatura
  - configuracoes contratuais por feira
- Diferenca importante:
  - este modulo foge do padrao simples e esta dividido em `controllers/`, `services/` e `dto/`
- Toque aqui quando:
  - contrato ou aditivo mudar
  - integracao de assinatura digital mudar
  - settings contratuais por feira precisarem ser ajustadas

#### `magic-links`

- Caminho: `src/modules/magic-links`
- Rota base: `magic-links`
- Responsabilidade: acessos especiais por link
- Toque aqui quando:
  - o fluxo precisa de acesso sem login tradicional
  - uma etapa do expositor depende de token/link temporario

### 6. Fluxos publicos

#### `public/interests`

- Caminho: `src/modules/public/interests`
- Rota base: `public/interests`
- Responsabilidade: cadastro publico de interessados sem autenticacao
- Toque aqui quando:
  - o lead entra pelo site
  - validacoes publicas de cadastro precisarem mudar
- Separacao importante:
  - `public/interests` e publico
  - `interests` e administrativo

### 7. Exportacao, planilhas e operacao

#### `excel-templates`

- Caminho: `src/modules/excel-templates`
- Responsabilidade: templates de exportacao

#### `excel-datasets`

- Caminho: `src/modules/excel-datasets`
- Rota base: `excel/datasets`
- Responsabilidade: datasets para exportacao

#### `excel-export-requirements`

- Caminho: `src/modules/excel-export-requirements`
- Rota base: `excel-export-requirements`
- Responsabilidade: requisitos/regras para exportacao

#### `excel-exports`

- Caminho: `src/modules/excel-exports`
- Rota base: `excel-exports`
- Responsabilidade: geracao das exportacoes

#### `health`

- Caminho: `src/modules/health`
- Rota base: `health`
- Responsabilidade: health check

#### `mail`

- Caminho: `src/modules/mail`
- Responsabilidade: servico global de envio de e-mail
- Regra pratica:
  - se a funcionalidade precisa enviar e-mail, normalmente nao crie modulo novo
  - use `MailService` no modulo de dominio que originou a acao

## Quais Modulos Costumam Andar Juntos

### Lead ate expositor confirmado

Fluxo comum:

`public/interests` -> `interests` -> `interest-fairs` -> `owner-fair-purchase` -> `contracts`

Se uma mudanca alterar essa jornada, revise todos esses pontos.

### Reserva de slot e mapa da feira

Fluxo comum:

`marketplace` -> `admin-marketplace` -> `marketplace-reservation-confirmation.service` -> `fair-maps`

Se o status do slot mudar, quase sempre vale revisar:

- reserva
- expiracao
- confirmacao
- sync do mapa
- vinculo da barraca

### Expositor autenticado e barracas

Fluxo comum:

`exhibitor-auth` -> `owners` -> `stalls` -> `exhibitor-fairs`

Se mudar identidade do expositor, email, ou barracas, revise esse grupo.

## Como Decidir Onde Implementar Uma Funcao Nova

### Regra 1: comece pelo dono do dominio

Pergunta pratica:

"Quem e dono da regra?"

Exemplos:

- confirmacao de reserva de slot: `marketplace`
- criacao de parcela: `owner-fair-purchase`
- alteracao de template contratual: `contracts`
- mudanca de status do slot no mapa: `fair-maps`
- cadastro publico de lead: `public/interests`

### Regra 2: diferencie admin, publico e expositor

Se a mesma entidade tem fluxos diferentes para perfis diferentes, mantenha separado:

- admin: controller/rota administrativa
- publico: modulo dentro de `src/modules/public`
- expositor autenticado: modulo especifico do expositor

### Regra 3: se a regra crescer, extraia service interno

Quando o fluxo fica grande demais, quebre dentro do proprio modulo.
Exemplo ja usado no projeto:

- `marketplace-reservation-confirmation.service.ts`
- `marketplace-missing-stall-notification.service.ts`

Esse e o melhor caminho quando:

- ha muitos passos
- ha efeitos colaterais
- o fluxo vai ser reutilizado por painel, webhook ou automacao

### Regra 4: se mexe em varias tabelas, use transaction

Use `prisma.$transaction(...)` quando a funcao:

- cria ou atualiza mais de um registro dependente
- muda status e gera log
- muda financeiro e mapa na mesma operacao
- cria vinculo com contrato ou compra

## Checklist Para Alterar Funcao Existente

Antes de editar:

1. achar a rota no controller
2. achar o service chamado por ela
3. achar o modelo Prisma envolvido
4. procurar efeitos colaterais
5. validar se existe versao publica/admin da mesma regra
6. validar se precisa de DTO novo ou ajuste em DTO existente

Efeitos colaterais que valem busca rapida:

- `sendMail(`
- `auditLog`
- `AuditService`
- `prisma.$transaction`
- `commercialStatus`
- `status:`
- `expiresAt`
- `stallId`
- `fairMapSlotId`

## Checklist Para Criar Funcao Nova

### Se for uma funcao pequena dentro de modulo existente

1. criar ou ajustar DTO em `dto/`
2. adicionar rota no controller correto
3. implementar regra no service do modulo
4. se precisar, adicionar validacoes de autorizacao e actor
5. se houver varias etapas, usar transaction
6. se houver log, usar audit
7. se houver e-mail, usar `MailService`
8. rodar `npm run build`

### Se for uma funcao nova e grande

Prefira:

1. manter a rota no controller do dominio
2. criar um service interno dedicado ao fluxo
3. deixar o service principal apenas orquestrando
4. exportar o service se outro modulo precisar reutilizar

## Onde Procurar Primeiro em Mudancas Comuns

### Quero alterar login ou token

- `src/modules/auth`
- `src/modules/exhibitor-auth`
- `src/common/guards`
- `src/common/decorators`

### Quero alterar cadastro de expositor

- `src/modules/owners`
- `src/modules/exhibitor-auth`
- `src/modules/public/interests`

### Quero alterar barraca

- `src/modules/stalls`
- `src/modules/exhibitor-fairs`
- `src/modules/marketplace`
- `src/modules/fair-maps`

### Quero alterar feira ou mapa

- `src/modules/fairs`
- `src/modules/map-templates`
- `src/modules/fair-maps`
- `src/modules/fair-showcase`

### Quero alterar fluxo comercial antigo

- `src/modules/interests`
- `src/modules/interest-fairs`
- `src/modules/owner-fair-purchase`
- `src/modules/contracts`

### Quero alterar fluxo de slots/marketplace

- `src/modules/marketplace`
- `src/modules/fair-maps`
- `src/modules/public/marketplace`
- `src/modules/stalls`

## Comandos Uteis Para Navegacao Rapida

Listar controllers:

```powershell
rg -n "@Controller\\(" src/modules -g "*controller.ts"
```

Listar modulos:

```powershell
rg --files src/modules -g "*module.ts"
```

Procurar uma regra por nome:

```powershell
rg -n "confirmReservation|notifyMissingStall|commercialStatus" src
```

Procurar modelo e usos:

```powershell
rg -n "MarketplaceSlotReservation|OwnerFairPurchase|FairMapBoothLink" prisma/schema.prisma src
```

## Hotspots do Projeto

Estes pontos merecem cuidado extra porque costumam quebrar fluxo em cadeia:

- confirmacao de reserva do marketplace
- sincronizacao entre reserva e mapa
- status financeiro do expositor na feira
- contratos e assinatura
- expiracao de reserva/interesse
- autenticacao do expositor

Se mexer em um hotspot, revise pelo menos:

- status persistido
- side effects
- logs
- e-mails
- rotas publicas vs admin

## Sugestao de Convencao Para Futuras Implementacoes

Quando adicionar funcionalidade nova, siga este formato:

1. `dto/alguma-acao.dto.ts`
2. metodo no controller
3. metodo no service principal
4. se crescer, criar `algum-fluxo.service.ts`
5. se precisar compartilhar contrato interno, criar `types/`
6. se acionar outro modulo, manter integracao explicita no modulo dono da regra

Exemplo bom ja existente:

- `admin-marketplace.controller.ts`
- `admin-marketplace.service.ts`
- `marketplace-reservation-confirmation.service.ts`
- `marketplace-missing-stall-notification.service.ts`

## Resumo Final

Se a duvida for "onde eu mexo?", use esta ordem:

1. descubra a rota
2. abra o controller
3. encontre o service
4. confirme as tabelas no Prisma
5. procure efeitos colaterais em mapa, financeiro, contrato, audit e e-mail
6. so depois edite

Se a regra for comercial ou operacional, assuma que ela nao termina em um arquivo so.

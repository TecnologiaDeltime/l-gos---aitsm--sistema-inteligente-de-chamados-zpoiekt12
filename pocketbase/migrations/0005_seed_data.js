migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const companies = app.findCollectionByNameOrId('companies')
    const units = app.findCollectionByNameOrId('company_units')
    const depts = app.findCollectionByNameOrId('company_departments')
    const contracts = app.findCollectionByNameOrId('contracts')
    const categories = app.findCollectionByNameOrId('tkt_categories')
    const queues = app.findCollectionByNameOrId('queues')
    const equipments = app.findCollectionByNameOrId('equipments')
    const tickets = app.findCollectionByNameOrId('tickets')
    const kb = app.findCollectionByNameOrId('knowledge_articles')

    // Seed Admin User
    let adminRecord
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
    } catch (_) {
      adminRecord = new Record(users)
      adminRecord.setEmail('inovacao@deltime.com.br')
      adminRecord.setPassword('Skip@Pass')
      adminRecord.setVerified(true)
      adminRecord.set('name', 'Administrador ITSM')
      adminRecord.set('role', 'admin')
      adminRecord.set('active', true)
      adminRecord.set('position', 'Gerente de TI')
      app.save(adminRecord)
    }

    // Seed Tech User
    let techRecord
    try {
      techRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico@deltime.com.br')
    } catch (_) {
      techRecord = new Record(users)
      techRecord.setEmail('tecnico@deltime.com.br')
      techRecord.setPassword('Skip@Pass')
      techRecord.setVerified(true)
      techRecord.set('name', 'Carlos Silva')
      techRecord.set('role', 'tecnico')
      techRecord.set('active', true)
      techRecord.set('position', 'Analista N2')
      app.save(techRecord)
    }

    // Seed Company
    let compRecord
    try {
      compRecord = app.findFirstRecordByData('companies', 'code', 'CLI-001')
    } catch (_) {
      compRecord = new Record(companies)
      compRecord.set('code', 'CLI-001')
      compRecord.set('legal_name', 'Acme Indústria e Comércio S/A')
      compRecord.set('trade_name', 'Acme Corp')
      compRecord.set('document', '12.345.678/0001-90')
      compRecord.set('phone', '(11) 3456-7890')
      compRecord.set('email', 'contato@acmecorp.com.br')
      compRecord.set('status', 'Ativo')
      compRecord.set('address_city', 'São Paulo')
      compRecord.set('address_state', 'SP')
      app.save(compRecord)
    }

    // Seed Unit
    let unitRecord
    try {
      unitRecord = app.findFirstRecordByData('company_units', 'name', 'Matriz SP')
    } catch (_) {
      unitRecord = new Record(units)
      unitRecord.set('company', compRecord.id)
      unitRecord.set('name', 'Matriz SP')
      unitRecord.set('address_city', 'São Paulo')
      unitRecord.set('manager_name', 'Roberto Mendes')
      app.save(unitRecord)
    }

    // Seed Dept
    let deptRecord
    try {
      deptRecord = app.findFirstRecordByData(
        'company_departments',
        'name',
        'Tecnologia da Informação',
      )
    } catch (_) {
      deptRecord = new Record(depts)
      deptRecord.set('company', compRecord.id)
      deptRecord.set('unit', unitRecord.id)
      deptRecord.set('name', 'Tecnologia da Informação')
      app.save(deptRecord)
    }

    // Seed Contract
    let contractRecord
    try {
      contractRecord = app.findFirstRecordByData('contracts', 'number', 'CT-2024-001')
    } catch (_) {
      contractRecord = new Record(contracts)
      contractRecord.set('company', compRecord.id)
      contractRecord.set('number', 'CT-2024-001')
      contractRecord.set('type', 'Pacote Mensal')
      contractRecord.set('status', 'Ativo')
      contractRecord.set('monthly_hours', 100)
      contractRecord.set('sla_response_time', 30)
      contractRecord.set('sla_solution_time', 240)
      contractRecord.set('priorities_available', ['P1', 'P2', 'P3', 'P4', 'P5'])
      contractRecord.set('service_days', 'Seg-Sex')
      contractRecord.set('service_hours_start', '08:00')
      contractRecord.set('service_hours_end', '18:00')
      app.save(contractRecord)
    }

    // Seed Categories
    let catHardware, catSoftware
    try {
      catHardware = app.findFirstRecordByData('tkt_categories', 'name', 'Hardware')
    } catch (_) {
      catHardware = new Record(categories)
      catHardware.set('name', 'Hardware')
      catHardware.set('description', 'Equipamentos físicos, computadores, periféricos')
      catHardware.set('active', true)
      app.save(catHardware)
    }

    try {
      catSoftware = app.findFirstRecordByData('tkt_categories', 'name', 'Software')
    } catch (_) {
      catSoftware = new Record(categories)
      catSoftware.set('name', 'Software')
      catSoftware.set('description', 'Sistemas operacionais, aplicativos, licenças')
      catSoftware.set('active', true)
      app.save(catSoftware)
    }

    // Seed Queue
    let queueN1
    try {
      queueN1 = app.findFirstRecordByData('queues', 'name', 'Suporte N1')
    } catch (_) {
      queueN1 = new Record(queues)
      queueN1.set('name', 'Suporte N1')
      queueN1.set('description', 'Fila de atendimento inicial e triagem')
      queueN1.set('active', true)
      queueN1.set('members', [adminRecord.id, techRecord.id])
      queueN1.set('categories', [catHardware.id, catSoftware.id])
      queueN1.set('distribution_rule', 'Disponibilidade')
      app.save(queueN1)
    }

    // Seed Equipment
    let eqLaptop
    try {
      eqLaptop = app.findFirstRecordByData('equipments', 'name', 'Notebook Dell Latitude 5420')
    } catch (_) {
      eqLaptop = new Record(equipments)
      eqLaptop.set('company', compRecord.id)
      eqLaptop.set('unit', unitRecord.id)
      eqLaptop.set('name', 'Notebook Dell Latitude 5420')
      eqLaptop.set('type', 'Notebook')
      eqLaptop.set('manufacturer', 'Dell')
      eqLaptop.set('model', 'Latitude 5420')
      eqLaptop.set('serial_number', 'DELL-987654')
      eqLaptop.set('patrimony_number', 'PAT-00452')
      eqLaptop.set('status', 'Ativo')
      app.save(eqLaptop)
    }

    // Seed Sample Ticket 1
    try {
      app.findFirstRecordByData('tickets', 'number', '2024-00001')
    } catch (_) {
      const now = new Date()
      const respDeadline = new Date(now.getTime() + 30 * 60000)
      const solDeadline = new Date(now.getTime() + 240 * 60000)

      const t1 = new Record(tickets)
      t1.set('number', '2024-00001')
      t1.set('company', compRecord.id)
      t1.set('unit', unitRecord.id)
      t1.set('department', deptRecord.id)
      t1.set('requester_name', 'Ana Souza')
      t1.set('requester_email', 'ana.souza@acmecorp.com.br')
      t1.set('contract', contractRecord.id)
      t1.set('type', 'Incidente')
      t1.set('category', catHardware.id)
      t1.set('equipment', eqLaptop.id)
      t1.set('title', 'Lentidão no carregamento do sistema e travamentos')
      t1.set(
        'description',
        'O notebook do usuário está apresentando telas azuis e extrema lentidão ao abrir o ERP.',
      )
      t1.set('source', 'Portal')
      t1.set('impact', 'Médio')
      t1.set('urgency', 'Alta')
      t1.set('priority', 'P2')
      t1.set('status', 'Em Atendimento')
      t1.set('queue', queueN1.id)
      t1.set('assigned_to', techRecord.id)
      t1.set('sla_response_deadline', respDeadline.toISOString())
      t1.set('sla_solution_deadline', solDeadline.toISOString())
      t1.set('sla_status', 'Dentro do Prazo')
      t1.set('work_hours', 1.5)
      app.save(t1)
    }

    // Seed Sample Ticket 2
    try {
      app.findFirstRecordByData('tickets', 'number', '2024-00002')
    } catch (_) {
      const now = new Date()
      const t2 = new Record(tickets)
      t2.set('number', '2024-00002')
      t2.set('company', compRecord.id)
      t2.set('requester_name', 'Fernando Dias')
      t2.set('requester_email', 'fernando@acmecorp.com.br')
      t2.set('type', 'Requisição de Serviço')
      t2.set('category', catSoftware.id)
      t2.set('title', 'Criação de novo usuário no VPN e e-mail')
      t2.set(
        'description',
        'Solicito criação de conta para novo colaborador no departamento financeiro.',
      )
      t2.set('source', 'E-mail')
      t2.set('impact', 'Baixo')
      t2.set('urgency', 'Média')
      t2.set('priority', 'P4')
      t2.set('status', 'Novo')
      t2.set('queue', queueN1.id)
      t2.set('sla_status', 'Dentro do Prazo')
      app.save(t2)
    }

    // Seed KB Article
    try {
      app.findFirstRecordByData(
        'knowledge_articles',
        'title',
        'Guia de Configuração de E-mail corporativo Outlook',
      )
    } catch (_) {
      const kb1 = new Record(kb)
      kb1.set('title', 'Guia de Configuração de E-mail corporativo Outlook')
      kb1.set('category', catSoftware.id)
      kb1.set('summary', 'Passo a passo para configurar contas IMAP/Exchange no Microsoft Outlook.')
      kb1.set(
        'content',
        '### Passos de Configuração:\n1. Abra o Microsoft Outlook.\n2. Clique em Arquivo > Adicionar Conta.\n3. Digite seu e-mail corporativo e senha.\n4. Selecione a opção Microsoft Exchange ou IMAP.\n5. Porta de entrada IMAP: 993 (SSL), Porta de saída SMTP: 587 (TLS).',
      )
      kb1.set('tags', 'outlook, email, configuracao')
      kb1.set('author', adminRecord.id)
      kb1.set('views', 42)
      app.save(kb1)
    }
  },
  (app) => {},
)

# 🚗 Calculadora de Combustível

Uma aplicação web moderna para calcular custos de viagem com integração ao Google Maps e Firebase.

## ✨ Funcionalidades

- **Cadastro de Veículos**: Gerencie seus veículos com informações de eficiência
- **Mapa Interativo**: Visualize rotas em tempo real com Google Maps
- **Cálculo Automático**: Calcule distâncias e custos de combustível automaticamente
- **Interface Moderna**: Design responsivo e intuitivo
- **Autocomplete**: Sugestões automáticas para origem e destino
- **Persistência de Dados**: Dados salvos no Firebase Firestore

## 🚀 Como Usar

### Pré-requisitos

1. **Chave da API do Google Maps**:
   - Acesse o [Google Cloud Console](https://console.cloud.google.com/)
   - Ative as APIs: Maps JavaScript API, Directions API, Places API
   - Configure as restrições de referenciadores HTTP

2. **Projeto Firebase**:
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
   - Configure o Firestore Database
   - Obtenha as credenciais do projeto

### Configuração

1. **Clone ou baixe o projeto**
2. **Configure as chaves da API**:
   - No arquivo `index.html`, substitua `AIzaSyCVK6ApQ4_PjedcFUL_wRIMLJNLfPC1KjY` pela sua chave do Google Maps
   - No arquivo `script.js`, atualize o objeto `firebaseConfig` com suas credenciais

3. **Execute o projeto**:
   ```bash
   # Usando Live Server (VS Code)
   # Ou usando http-server
   npx http-server . -p 5500 -o
   ```

### Restrições da API do Google Maps

Para desenvolvimento local, configure as restrições de referenciadores HTTP:
- `http://127.0.0.1:5500/*`
- `http://localhost:5500/*`

Para produção, substitua pelos domínios do seu site.

## 📱 Como Usar a Aplicação

### 1. Cadastrar Veículos
- Preencha o modelo e a eficiência (km/l) do veículo
- Clique em "Adicionar Veículo"
- Gerencie veículos existentes (editar/ativar/inativar)

### 2. Planejar Viagem
- Selecione um veículo ativo
- Digite a origem (com autocomplete)
- Digite o destino (com autocomplete)
- Clique em "Calcular Rota"

### 3. Visualizar Resultados
- Veja a rota no mapa interativo
- Confira a distância calculada
- Ajuste o preço da gasolina se necessário
- Clique em "Calcular Custo" para ver o valor final

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Estilização**: Tailwind CSS, Font Awesome
- **Mapas**: Google Maps JavaScript API
- **Backend**: Firebase Firestore
- **Responsividade**: Design mobile-first

## 📁 Estrutura do Projeto

```
calculadora-combustivel/
├── index.html          # Página principal
├── script.js           # Lógica da aplicação
├── style.css           # Estilos personalizados
├── package.json        # Configurações do projeto
└── README.md          # Documentação
```

## 🔧 Personalização

### Cores e Tema
Edite as variáveis CSS no arquivo `style.css` ou ajuste a configuração do Tailwind no `index.html`.

### Funcionalidades Adicionais
- Adicione novos tipos de combustível
- Implemente histórico de viagens
- Integre com APIs de preços de combustível
- Adicione notificações push

## 🐛 Solução de Problemas

### Mapa não carrega
- Verifique se a chave da API está correta
- Confirme se as APIs necessárias estão ativadas
- Verifique as restrições de referenciadores HTTP

### Erro no Firebase
- Confirme se as credenciais estão corretas
- Verifique se o Firestore está configurado
- Confirme se as regras de segurança permitem leitura/escrita

### Autocomplete não funciona
- Verifique se a Places API está ativada
- Confirme se a biblioteca `places` está carregada

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novas funcionalidades
- Enviar pull requests
- Melhorar a documentação

---

https://victordepaula06.github.io/QuantoVouGastar-/

**Desenvolvido com ❤️ para facilitar o planejamento de viagens**

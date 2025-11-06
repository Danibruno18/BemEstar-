#!/usr/bin/env python3
"""
Teste completo do backend da aplicação de questionários para psicólogos
Testa todos os endpoints de autenticação, psicólogo e paciente
"""

import requests
import json
import sys
from datetime import datetime

# URL base do backend
BASE_URL = "https://psych-forms.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.psychologist_token = None
        self.patient_token = None
        self.created_form_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log do resultado do teste"""
        status = "✅ PASSOU" if success else "❌ FALHOU"
        print(f"{status} - {test_name}")
        if details:
            print(f"   Detalhes: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Faz requisição HTTP"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            print(f"Erro na requisição {method} {url}: {str(e)}")
            return None
    
    def get_auth_headers(self, token):
        """Retorna headers de autenticação"""
        return {"Authorization": f"Bearer {token}"}
    
    def test_psychologist_registration(self):
        """Teste: Registro de psicólogo"""
        data = {
            "username": "dra_maria_silva",
            "password": "senha123",
            "name": "Dra. Maria Silva",
            "email": "maria.silva@psicologo.com",
            "role": "psychologist"
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "access_token" in result and result["user"]["role"] == "psychologist":
                self.psychologist_token = result["access_token"]
                self.log_test("Registro de psicólogo", True, f"Token obtido para {result['user']['name']}")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        if response:
            details += f", Resposta: {response.text}"
        self.log_test("Registro de psicólogo", False, details)
        return False
    
    def test_patient_registration(self):
        """Teste: Registro de paciente"""
        data = {
            "username": "joao_santos",
            "password": "senha456",
            "name": "João Santos",
            "email": "joao.santos@email.com",
            "role": "patient"
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "access_token" in result and result["user"]["role"] == "patient":
                self.patient_token = result["access_token"]
                self.log_test("Registro de paciente", True, f"Token obtido para {result['user']['name']}")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        if response:
            details += f", Resposta: {response.text}"
        self.log_test("Registro de paciente", False, details)
        return False
    
    def test_psychologist_login(self):
        """Teste: Login de psicólogo"""
        data = {
            "username": "dra_maria_silva",
            "password": "senha123"
        }
        
        response = self.make_request("POST", "/auth/login", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "access_token" in result:
                self.log_test("Login de psicólogo", True, "Login realizado com sucesso")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Login de psicólogo", False, details)
        return False
    
    def test_invalid_login(self):
        """Teste: Login com credenciais inválidas"""
        data = {
            "username": "usuario_inexistente",
            "password": "senha_errada"
        }
        
        response = self.make_request("POST", "/auth/login", data)
        
        if response and response.status_code == 401:
            self.log_test("Login com credenciais inválidas", True, "Erro 401 retornado corretamente")
            return True
        
        details = f"Status esperado: 401, Recebido: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Login com credenciais inválidas", False, details)
        return False
    
    def test_token_verification(self):
        """Teste: Verificação de token JWT"""
        if not self.psychologist_token:
            self.log_test("Verificação de token JWT", False, "Token de psicólogo não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("GET", "/auth/me", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if result["role"] == "psychologist":
                self.log_test("Verificação de token JWT", True, f"Token válido para {result['name']}")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Verificação de token JWT", False, details)
        return False
    
    def test_create_form(self):
        """Teste: Criar formulário"""
        if not self.psychologist_token:
            self.log_test("Criar formulário", False, "Token de psicólogo não disponível")
            return False
        
        data = {
            "title": "Questionário de Ansiedade",
            "description": "Avaliação dos níveis de ansiedade do paciente",
            "questions": [
                {
                    "id": "q1",
                    "text": "Como você se sente em relação ao seu nível de ansiedade?",
                    "order": 1
                },
                {
                    "id": "q2", 
                    "text": "Com que frequência você experimenta sintomas de ansiedade?",
                    "order": 2
                },
                {
                    "id": "q3",
                    "text": "Descreva uma situação recente que causou ansiedade:",
                    "order": 3
                }
            ]
        }
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("POST", "/forms", data, headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and result["title"] == data["title"]:
                self.created_form_id = result["id"]
                self.log_test("Criar formulário", True, f"Formulário criado com ID: {result['id']}")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        if response:
            details += f", Resposta: {response.text}"
        self.log_test("Criar formulário", False, details)
        return False
    
    def test_list_psychologist_forms(self):
        """Teste: Listar formulários do psicólogo"""
        if not self.psychologist_token:
            self.log_test("Listar formulários do psicólogo", False, "Token de psicólogo não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("GET", "/forms", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Listar formulários do psicólogo", True, f"Encontrados {len(result)} formulários")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Listar formulários do psicólogo", False, details)
        return False
    
    def test_get_form_details(self):
        """Teste: Ver detalhes de um formulário"""
        if not self.psychologist_token or not self.created_form_id:
            self.log_test("Ver detalhes de formulário", False, "Token ou ID do formulário não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("GET", f"/forms/{self.created_form_id}", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if result["id"] == self.created_form_id and "questions" in result:
                self.log_test("Ver detalhes de formulário", True, f"Detalhes obtidos para formulário {self.created_form_id}")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Ver detalhes de formulário", False, details)
        return False
    
    def test_update_form(self):
        """Teste: Editar formulário existente"""
        if not self.psychologist_token or not self.created_form_id:
            self.log_test("Editar formulário", False, "Token ou ID do formulário não disponível")
            return False
        
        data = {
            "title": "Questionário de Ansiedade - Atualizado",
            "description": "Versão atualizada da avaliação de ansiedade"
        }
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("PUT", f"/forms/{self.created_form_id}", data, headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if result["title"] == data["title"]:
                self.log_test("Editar formulário", True, "Formulário atualizado com sucesso")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Editar formulário", False, details)
        return False
    
    def test_patient_list_forms(self):
        """Teste: Paciente listar formulários disponíveis"""
        if not self.patient_token:
            self.log_test("Paciente listar formulários", False, "Token de paciente não disponível")
            return False
        
        headers = self.get_auth_headers(self.patient_token)
        response = self.make_request("GET", "/patient/forms", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Paciente listar formulários", True, f"Paciente encontrou {len(result)} formulários")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Paciente listar formulários", False, details)
        return False
    
    def test_patient_view_form(self):
        """Teste: Paciente ver detalhes de formulário"""
        if not self.patient_token or not self.created_form_id:
            self.log_test("Paciente ver formulário", False, "Token de paciente ou ID do formulário não disponível")
            return False
        
        headers = self.get_auth_headers(self.patient_token)
        response = self.make_request("GET", f"/forms/{self.created_form_id}", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if "questions" in result:
                self.log_test("Paciente ver formulário", True, "Paciente conseguiu ver detalhes do formulário")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Paciente ver formulário", False, details)
        return False
    
    def test_patient_submit_response(self):
        """Teste: Paciente responder formulário"""
        if not self.patient_token or not self.created_form_id:
            self.log_test("Paciente responder formulário", False, "Token de paciente ou ID do formulário não disponível")
            return False
        
        data = {
            "formId": self.created_form_id,
            "answers": [
                {
                    "questionId": "q1",
                    "questionText": "Como você se sente em relação ao seu nível de ansiedade?",
                    "answerText": "Sinto-me moderadamente ansioso, especialmente em situações sociais."
                },
                {
                    "questionId": "q2",
                    "questionText": "Com que frequência você experimenta sintomas de ansiedade?",
                    "answerText": "Aproximadamente 3-4 vezes por semana."
                },
                {
                    "questionId": "q3",
                    "questionText": "Descreva uma situação recente que causou ansiedade:",
                    "answerText": "Uma apresentação no trabalho na semana passada me deixou muito nervoso."
                }
            ]
        }
        
        headers = self.get_auth_headers(self.patient_token)
        response = self.make_request("POST", "/responses", data, headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and "message" in result:
                self.log_test("Paciente responder formulário", True, "Resposta enviada com sucesso")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        if response:
            details += f", Resposta: {response.text}"
        self.log_test("Paciente responder formulário", False, details)
        return False
    
    def test_patient_view_responses(self):
        """Teste: Paciente ver histórico de respostas"""
        if not self.patient_token:
            self.log_test("Paciente ver histórico", False, "Token de paciente não disponível")
            return False
        
        headers = self.get_auth_headers(self.patient_token)
        response = self.make_request("GET", "/responses/my", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Paciente ver histórico", True, f"Paciente tem {len(result)} respostas no histórico")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Paciente ver histórico", False, details)
        return False
    
    def test_psychologist_view_responses(self):
        """Teste: Psicólogo ver respostas dos pacientes"""
        if not self.psychologist_token or not self.created_form_id:
            self.log_test("Psicólogo ver respostas", False, "Token de psicólogo ou ID do formulário não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("GET", f"/forms/{self.created_form_id}/responses", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Psicólogo ver respostas", True, f"Psicólogo encontrou {len(result)} respostas")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Psicólogo ver respostas", False, details)
        return False
    
    def test_patient_cannot_create_form(self):
        """Teste: Paciente não pode criar formulários"""
        if not self.patient_token:
            self.log_test("Validação: Paciente não pode criar formulário", False, "Token de paciente não disponível")
            return False
        
        data = {
            "title": "Tentativa de criação por paciente",
            "description": "Isso não deveria funcionar",
            "questions": []
        }
        
        headers = self.get_auth_headers(self.patient_token)
        response = self.make_request("POST", "/forms", data, headers)
        
        if response and response.status_code == 403:
            self.log_test("Validação: Paciente não pode criar formulário", True, "Erro 403 retornado corretamente")
            return True
        
        details = f"Status esperado: 403, Recebido: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Validação: Paciente não pode criar formulário", False, details)
        return False
    
    def test_psychologist_cannot_access_patient_endpoints(self):
        """Teste: Psicólogo não pode acessar endpoints de paciente"""
        if not self.psychologist_token:
            self.log_test("Validação: Psicólogo não pode acessar endpoints de paciente", False, "Token de psicólogo não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("GET", "/patient/forms", headers=headers)
        
        if response and response.status_code == 403:
            self.log_test("Validação: Psicólogo não pode acessar endpoints de paciente", True, "Erro 403 retornado corretamente")
            return True
        
        details = f"Status esperado: 403, Recebido: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Validação: Psicólogo não pode acessar endpoints de paciente", False, details)
        return False
    
    def test_unauthorized_access(self):
        """Teste: Acesso sem token de autorização"""
        response = self.make_request("GET", "/forms")
        
        if response and response.status_code == 403:
            self.log_test("Validação: Acesso sem autorização", True, "Erro 403 retornado corretamente")
            return True
        
        details = f"Status esperado: 403, Recebido: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Validação: Acesso sem autorização", False, details)
        return False
    
    def test_delete_form(self):
        """Teste: Deletar formulário"""
        if not self.psychologist_token or not self.created_form_id:
            self.log_test("Deletar formulário", False, "Token de psicólogo ou ID do formulário não disponível")
            return False
        
        headers = self.get_auth_headers(self.psychologist_token)
        response = self.make_request("DELETE", f"/forms/{self.created_form_id}", headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_test("Deletar formulário", True, "Formulário deletado com sucesso")
                return True
        
        details = f"Status: {response.status_code if response else 'Sem resposta'}"
        self.log_test("Deletar formulário", False, details)
        return False
    
    def run_all_tests(self):
        """Executa todos os testes"""
        print(f"🧪 INICIANDO TESTES DO BACKEND")
        print(f"URL Base: {self.base_url}")
        print("=" * 60)
        
        # Testes de autenticação
        print("\n📋 TESTES DE AUTENTICAÇÃO")
        self.test_psychologist_registration()
        self.test_patient_registration()
        self.test_psychologist_login()
        self.test_invalid_login()
        self.test_token_verification()
        
        # Testes do fluxo do psicólogo
        print("\n👩‍⚕️ TESTES DO FLUXO DO PSICÓLOGO")
        self.test_create_form()
        self.test_list_psychologist_forms()
        self.test_get_form_details()
        self.test_update_form()
        
        # Testes do fluxo do paciente
        print("\n🧑‍🦱 TESTES DO FLUXO DO PACIENTE")
        self.test_patient_list_forms()
        self.test_patient_view_form()
        self.test_patient_submit_response()
        self.test_patient_view_responses()
        
        # Testes de visualização de respostas
        print("\n📊 TESTES DE RESPOSTAS")
        self.test_psychologist_view_responses()
        
        # Testes de validação e segurança
        print("\n🔒 TESTES DE VALIDAÇÃO E SEGURANÇA")
        self.test_patient_cannot_create_form()
        self.test_psychologist_cannot_access_patient_endpoints()
        self.test_unauthorized_access()
        
        # Teste de limpeza
        print("\n🗑️ TESTE DE LIMPEZA")
        self.test_delete_form()
        
        # Resumo dos resultados
        print("\n" + "=" * 60)
        print("📊 RESUMO DOS TESTES")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Testes que passaram: {passed}")
        print(f"❌ Testes que falharam: {total - passed}")
        print(f"📈 Taxa de sucesso: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ TESTES QUE FALHARAM:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 TODOS OS TESTES PASSARAM!")
        sys.exit(0)
    else:
        print("\n⚠️ ALGUNS TESTES FALHARAM!")
        sys.exit(1)
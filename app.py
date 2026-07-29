from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from google import genai
import PIL.Image
import os
import time
import json
import subprocess

app = Flask(__name__)
CORS(app) 

# --- CONFIGURAÇÕES ---
# Coloque a sua chave de API aqui:
client = genai.Client(api_key="COLE_SUA_NOVA_CHAVE_AQUI")

# Caminho da sua pasta de estudos:
PASTA_ALVO = r"C:\Users\artur\OneDrive\Área de Trabalho\ESTUDOS"

# Caminho do executável do Xournal++ no seu PC:
XOURNAL_PATH = r"C:\Program Files\Xournal++\bin\xournalpp.exe"

@app.route('/mapear')
def mapear_pdfs():
    def gerar_eventos():
        for root, dirs, files in os.walk(PASTA_ALVO):
            for file in files:
                if file.lower().endswith('.pdf'):
                    caminho_completo = os.path.join(root, file)
                    stats = os.stat(caminho_completo)
                    dados = {
                        "status": "processing",
                        "file": {
                            "name": file,
                            "path": caminho_completo,
                            "size": stats.st_size,      
                            "mtime": stats.st_mtime     
                        }
                    }
                    yield f"data: {json.dumps(dados)}\n\n"
                    time.sleep(0.01) 
        
        yield f"data: {json.dumps({'status': 'done'})}\n\n"

    return Response(gerar_eventos(), mimetype='text/event-stream')

@app.route('/abrir_local')
def abrir_local():
    caminho = request.args.get('caminho')
    if caminho and os.path.exists(caminho):
        try:
            subprocess.Popen([XOURNAL_PATH, caminho])
            return jsonify({"status": "ok", "message": "Abrindo no Xournal++"})
        except Exception as e:
            try:
                os.startfile(caminho)
                return jsonify({"status": "fallback", "message": "Xournal não encontrado, abrindo leitor padrão."})
            except Exception as e2:
                return jsonify({"status": "error", "message": str(e2)}), 500
    return jsonify({"error": "Arquivo não encontrado"}), 404

# --- ROTA DE INTELIGÊNCIA ARTIFICIAL: ANÁLISE DE ERRO ---
@app.route('/analisar_erro', methods=['POST'])
def analisar_erro():
    if 'image' not in request.files:
        return jsonify({"error": "Nenhuma imagem recebida do site"}), 400
    
    file = request.files['image']
    img = PIL.Image.open(file.stream)
    
    prompt = """
    Você é um professor especialista em concursos públicos (bancas como FCC, FGV, Cebraspe).
    Analise o print desta questão de concurso.
    Retorne estritamente um JSON com duas chaves:
    1. "conceito": A regra, lei ou explicação direta do porquê a alternativa correta é a correta. Seja direto e didático.
    2. "contexto": Explique qual foi a 'pegadinha', palavra alterada ou o contexto que a banca usou para tentar confundir o candidato na alternativa errada.
    
    Formato de saída:
    {"conceito": "...", "contexto": "..."}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[img, prompt]
        )
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        dados_json = json.loads(text.strip())
        return jsonify(dados_json)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- NOVA ROTA: GERADOR DE FLASHCARDS POR PDF COM ESPERA SEGURA ---
@app.route('/gerar_flashcards_pdf', methods=['POST'])
def gerar_flashcards_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo PDF recebido"}), 400
    
    file = request.files['file']
    temp_path = os.path.join("temp_" + file.filename)
    file.save(temp_path)
    
    try:
        # Faz o upload para a nuvem do Gemini
        sample_file = client.files.upload(file=temp_path)
        
        # LOOP DE SEGURANÇA: Aguarda a IA terminar de ler o PDF grande
        # O Gemini precisa de alguns segundos para extrair o texto de arquivos extensos.
        while getattr(sample_file.state, 'name', str(sample_file.state)) == "PROCESSING":
            time.sleep(2) # Espera 2 segundos
            sample_file = client.files.get(name=sample_file.name) # Checa o status novamente
            
        if getattr(sample_file.state, 'name', str(sample_file.state)) == "FAILED":
            raise Exception("A inteligência artificial não conseguiu ler o conteúdo deste PDF.")
        
        prompt = """
        Atue como um examinador especialista em bancas de concurso público.
        Analise o documento PDF fornecido, extraia os conceitos mais críticos, prazos, regras ou exceções, 
        e transforme-os em flashcards de memorização ativa de alta qualidade.
        Gere entre 4 e 7 flashcards diretos e objetivos.
        
        REGRAS ABSOLUTAS DE SAÍDA:
        O retorno deve ser ESTRITAMENTE um array JSON válido contendo objetos. NENHUM texto antes, NENHUM texto depois. Não use crases de marcação markdown.
        
        Estrutura obrigatória de cada objeto:
        - "palavra": A pergunta, conceito ou lacuna.
        - "significado": A resposta direta e correta.
        - "sinonimos": Array com 2 termos chaves do assunto.
        - "aplicacao": Uma dica, mnemônico ou exceção à regra tirada do texto.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[sample_file, prompt]
        )
        
        # Limpa o arquivo temporário
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        cards_json = json.loads(text.strip())
        return jsonify(cards_json)
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Servidor rodando na porta 5000. IA, PDFs e Xournal++ ativados!")
    app.run(port=5000, debug=True)
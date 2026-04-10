from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from google import genai
import PIL.Image
import os
import time
import json

app = Flask(__name__)
CORS(app) 

# --- CONFIGURAÇÕES ---
# 1. Coloque a sua chave de API NOVA aqui:
client = genai.Client(api_key="AIzaSyAhljNrc1YmUYo104caV1kEePVaADZZA8c")

# 2. Confirme o caminho da sua pasta de PDFs:
PASTA_ALVO = r"C:\Users\artur\OneDrive\Área de Trabalho\ESTUDOS"

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

@app.route('/abrir')
def abrir_pdf():
    caminho = request.args.get('caminho')
    if caminho and os.path.exists(caminho):
        return send_file(caminho)
    return "Arquivo não encontrado", 404

# --- NOVA ROTA: INTELIGÊNCIA ARTIFICIAL ---
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
        
        # Limpeza blindada para garantir que o Javascript consiga ler o JSON
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
            
        if text.endswith("```"):
            text = text[:-3]
            
        text = text.strip()
        
        # Valida se é um JSON de verdade antes de mandar pro site
        dados_json = json.loads(text)
        return jsonify(dados_json)
        
    except Exception as e:
        print(f"================ ERRO NA IA ================\n{e}\n============================================")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Servidor rodando na porta 5000. IA Ativada com a nova biblioteca e chave segura!")
    app.run(port=5000, debug=True)
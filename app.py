from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
import os
import time
import json

app = Flask(__name__)
CORS(app) 

# Lembre-se de verificar se o seu caminho alvo está correto aqui!
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

if __name__ == '__main__':
    print("Servidor rodando. Clique em 'Atualizar Mapeamento' no seu site.")
    app.run(port=5000, debug=True)
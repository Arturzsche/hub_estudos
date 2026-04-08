from flask import Flask, Response, jsonify
from flask_cors import CORS
import os
import time
import json

app = Flask(__name__)
# Permite que o seu navegador receba os dados mesmo abrindo o HTML diretamente
CORS(app) 

# ALTERE AQUI PARA A PASTA ONDE VOCÊ GUARDA SEUS MATERIAIS DE ESTUDO
PASTA_ALVO = r"C:\Users\SeuUsuario\Documents"

@app.route('/mapear')
def mapear_pdfs():
    def gerar_eventos():
        for root, dirs, files in os.walk(PASTA_ALVO):
            for file in files:
                if file.lower().endswith('.pdf'):
                    caminho_completo = os.path.join(root, file)
                    
                    dados = {
                        "status": "processing",
                        "file": {
                            "name": file,
                            "path": caminho_completo
                        }
                    }
                    
                    # Envia os dados no padrão SSE
                    yield f"data: {json.dumps(dados)}\n\n"
                    
                    # Um pequeno delay para dar um visual legal de "processamento" na tela
                    time.sleep(0.05) 
        
        # Avisa ao Javascript que finalizou
        yield f"data: {json.dumps({'status': 'done'})}\n\n"

    return Response(gerar_eventos(), mimetype='text/event-stream')

if __name__ == '__main__':
    print("Servidor rodando. Clique em 'Iniciar Mapeamento' no seu site.")
    app.run(port=5000, debug=True)
import tkinter as tk
from tkinter import ttk
import webview
import threading
import sys
import os


class ChatApp:
    def __init__(self):
        self.window = None
        
    def create_window(self):
        """Crea la finestra webview con le impostazioni specificate"""
        
        # URL di mattechat
        url = "https://matte-chat.netlify.app/"
        
        # Configurazione della finestra
        window_config = {
            'title': 'Matte Chat',
            'url': url,
            'width': 375,      # Larghezza "smartphone"
            'height': 700,     # Altezza "smartphone"
            'resizable': False,  # Non ridimensionabile
            'min_size': (375, 667),
            'on_top': False,
            'shadow': True,
        }
        
        # Crea la finestra
        self.window = webview.create_window(**window_config)
        
    def start(self):
        """Avvia l'applicazione"""
        try:
            self.create_window()
            
            # Avvia la finestra con configurazioni corrette
            webview.start(
                debug=False,
                http_server=False,     # Nessun server locale
                user_agent='MatteChat/1.0',  # User agent
                private_mode=True      # Modalità privata
            )
            
        except Exception as e:
            print(f"Errore nell'avvio dell'app: {e}")
            self.show_error_dialog(str(e))
    
    def show_error_dialog(self, error_message):
        """Mostra dialog di errore in caso di problemi"""
        root = tk.Tk()
        root.withdraw()  # Nasconde la finestra principale
        
        # Crea messaggio errore
        error_window = tk.Toplevel(root)
        error_window.title("Errore")
        error_window.geometry("400x200")
        error_window.resizable(False, False)
        
        # Centra la finestra
        screen_width = error_window.winfo_screenwidth()
        screen_height = error_window.winfo_screenheight()
        x = int(screen_width / 2 - 200)
        y = int(screen_height / 2 - 100)
        error_window.geometry(f"+{x}+{y}")
        
        # Contenuto dell'errore
        frame = ttk.Frame(error_window, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="Errore nell'avvio dell'applicazione:",
                  font=('Arial', 12, 'bold')).pack(pady=(0, 10))
        
        error_text = tk.Text(frame, height=6, width=45, wrap=tk.WORD)
        error_text.pack(pady=(0, 10))
        error_text.insert(tk.END, error_message)
        error_text.config(state=tk.DISABLED)
        
        def close_app():
            error_window.destroy()
            root.quit()
            sys.exit(1)
        
        ttk.Button(frame, text="Chiudi", command=close_app).pack()
        
        error_window.protocol("WM_DELETE_WINDOW", close_app)
        error_window.mainloop()


def main():
    """Funzione principale"""
    # Verifica che pywebview sia installato
    try:
        import webview
    except ImportError:
        print("Errore: pywebview non è installato!")
        print("Installa con: pip install pywebview")
        sys.exit(1)
    
    # Crea e avvia l'app
    app = ChatApp()
    app.start()


if __name__ == "__main__":
    main()
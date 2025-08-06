import os
import pathlib

def export_repo_to_text(root_dir, output_file, include_extensions=None, exclude_dirs=None):
    """Экспортирует код репозитория в текстовый файл"""
    if include_extensions is None:
        include_extensions = ['.py', '.js', '.html', '.css', '.md', '.java', '.c', '.cpp', '.h']
    
    if exclude_dirs is None:
        exclude_dirs = ['.git', '__pycache__', 'node_modules', 'venv', '.venv', 'env', 'dist', 'build']
    
    # Создаем папки для выходного файла если нужно
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    root_dir = pathlib.Path(root_dir).resolve()
    exclude_dirs_set = set(exclude_dirs)

    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk(root_dir):
            root_path = pathlib.Path(root)
            
            # Фильтрация директорий (по имени)
            dirs[:] = [d for d in dirs if d not in exclude_dirs_set]
            
            for file in files:
                file_path = root_path / file
                
                # Проверка расширения
                if file_path.suffix not in include_extensions:
                    continue

                # Пропуск если путь содержит исключённую папку (например: .../.venv/...)
                if any(part in exclude_dirs_set for part in file_path.parts):
                    continue
                
                try:
                    # Заголовок файла
                    rel_path = file_path.relative_to(root_dir)
                    outfile.write(f"\n\n{'=' * 80}\n")
                    outfile.write(f"FILE: {rel_path}\n")
                    outfile.write(f"{'=' * 80}\n\n")
                    
                    # Чтение содержимого
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read())
                        
                except UnicodeDecodeError:
                    outfile.write(f"\n\n[BINARY FILE: {rel_path} - SKIPPED]\n")
                except Exception as e:
                    outfile.write(f"\n\n[ERROR READING {rel_path}: {str(e)}]\n")

if __name__ == "__main__":
    REPO_DIR = pathlib.Path(__file__).parent.resolve()
    OUTPUT_PATH = REPO_DIR / "docs/repository_code.txt"
    
    print(f"Старт экспорта репозитория: {REPO_DIR}")
    print(f"Выходной файл: {OUTPUT_PATH}")
    
    export_repo_to_text(
        root_dir=REPO_DIR,
        output_file=str(OUTPUT_PATH),
        include_extensions=[".py", ".js", ".html", ".css", ".md", ".ts", ".json",".tsx",".",".",".",],
        exclude_dirs=[".git", "__pycache__", "venv", ".venv", "env", "dist", "build", "node_modules"]
    )
    
    print(f"Экспорт завершен! Размер файла: {os.path.getsize(OUTPUT_PATH)/1024:.2f} KB")

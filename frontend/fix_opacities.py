import os

components_dir = r"C:\Dev\projects\no BS Resonance\frontend\src\components"

def fix_css():
    for root, dirs, files in os.walk(components_dir):
        for f in files:
            if not f.endswith('.tsx'): continue
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            content = content.replace('rgba(255,255,255,0.7)', 'rgba(255,255,255,0.05)')
            content = content.replace('rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)')
            content = content.replace('background: "rgba(255,255,255,0.4)"', 'background: "rgba(255,255,255,0.05)"')
            content = content.replace('background: "rgba(255,255,255,0.5)"', 'background: "rgba(255,255,255,0.05)"')
            content = content.replace('background: "rgba(255,255,255,0.3)"', 'background: "rgba(255,255,255,0.05)"')
            content = content.replace('background: "rgba(255,255,255,0.25)"', 'background: "rgba(255,255,255,0.05)"')
            content = content.replace('background: "rgba(255,255,255,0.22)"', 'background: "rgba(255,255,255,0.05)"')
            content = content.replace('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.2)')
            content = content.replace('rgba(255,255,255,0.8)', 'rgba(255,255,255,0.2)')
            content = content.replace('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.3)')
            
            with open(path, 'w', encoding='utf-8') as file:
                 file.write(content)

fix_css()
print("Fixed opacities")

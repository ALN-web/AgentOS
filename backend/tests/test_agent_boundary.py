import os
import ast

def test_agent_layer_has_no_provider_imports():
    """Agents MUST NOT directly call provider SDKs or import googleapiclient.
    Only the appropriate Tool/integration layer may do so.
    """
    agent_dir = os.path.join(os.path.dirname(__file__), "..", "app", "services", "agents")
    banned_imports = {"googleapiclient", "google.oauth2", "google.auth"}
    
    for root, _, files in os.walk(agent_dir):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=path)
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            base_module = alias.name.split('.')[0]
                            assert alias.name not in banned_imports, f"Banned import {alias.name} found in {file}"
                            assert base_module not in banned_imports, f"Banned import {base_module} found in {file}"
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            base_module = node.module.split('.')[0]
                            assert node.module not in banned_imports, f"Banned import {node.module} found in {file}"
                            assert base_module not in banned_imports, f"Banned import {base_module} found in {file}"

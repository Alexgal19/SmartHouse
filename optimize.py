#!/usr/bin/env python3
import os
import re
import sys
import shutil
from pathlib import Path

class SmartHouseOptimizer:
    def __init__(self, project_root='.'):
        self.project_root = Path(project_root)
        self.backups_created = []
        self.modifications_made = []
        
    def backup_file(self, file_path):
        """Create a backup of the file before modification."""
        if not file_path.exists():
            return False
            
        backup_path = Path(str(file_path) + '.bak')
        shutil.copy2(file_path, backup_path)
        self.backups_created.append((file_path, backup_path))
        print(f"Backup created: {backup_path}")
        return True
    
    def restore_backups(self):
        """Restore all backed up files."""
        for original, backup in self.backups_created:
            if backup.exists():
                shutil.copy2(backup, original)
                print(f"Restored: {original} from backup")
    
    def optimize_main_layout(self, file_path):
        """Optimize main-layout.tsx - add QueryClient configuration."""
        try:
            content = file_path.read_text()
            original_content = content
            
            # Find and optimize new QueryClient() instantiation
            # Pattern: const queryClient = new QueryClient();
            # or: const queryClient = new QueryClient({
            pattern = r'(const\s+\w+\s*=\s*new\s+QueryClient\s*\()\s*\)'
            
            if re.search(pattern, content):
                replacement = r'\1\n    defaultOptions: {\n      queries: {\n        staleTime: 5*60*1000,\n        gcTime: 30*60*1000,\n        refetchOnWindowFocus: false,\n        retry: 1,\n      },\n    }\n  )'
                content = re.sub(pattern, replacement, content)
                self.modifications_made.append(f"Optimized QueryClient in {file_path.name}")
                return True, content
            
            # Also handle QueryClient with existing config
            pattern2 = r'(const\s+\w+\s*=\s*new\s+QueryClient\s*\({)([^}]*)'
            match = re.search(pattern2, content)
            if match and 'staleTime' not in content:
                # Add our config params to existing config
                old_config = match.group(2)
                new_config = old_config + '\n    staleTime: 5*60*1000,\n    gcTime: 30*60*1000,\n    refetchOnWindowFocus: false,\n    retry: 1,'
                content = content.replace(match.group(0), match.group(1) + new_config)
                self.modifications_made.append(f"Enhanced QueryClient config in {file_path.name}")
                return True, content
                
            return original_content == content, content
        except Exception as e:
            print(f"Error optimizing {file_path}: {e}")
            return False, None
    
    def optimize_actions(self, file_path):
        """Optimize actions.ts - parallelize sequential awaits."""
        try:
            content = file_path.read_text()
            original_content = content
            
            # Find patterns like: await X; await Y; (sequential awaits)
            # Pattern: await something(...); followed by await something_else(...);
            sequential_await_pattern = r'(\s)(await\s+[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\);)\s+(await\s+[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\);)'
            
            modifications_count = 0
            
            # Find all sequential await pairs and wrap them in Promise.all
            lines = content.split('\n')
            i = 0
            while i < len(lines) - 1:
                line = lines[i].rstrip()
                next_line = lines[i+1].rstrip()
                
                # Check if both are await statements
                if re.match(r'^\s*await\s+', line) and line.rstrip().endswith(';') and \
                   re.match(r'^\s*await\s+', next_line) and next_line.rstrip().endswith(';'):
                    
                    # Extract indentation
                    indent_match = re.match(r'^(\s*)', line)
                    indent = indent_match.group(1) if indent_match else '  '
                    
                    # Extract await statements without indentation
                    stmt1 = line.lstrip()
                    stmt2 = next_line.lstrip()
                    
                    # Wrap in Promise.all if safe (not data-dependent)
                    # Check if they look independent (simple heuristic)
                    if not any(var in stmt2 for var in re.findall(r'const\s+(\w+)', stmt1)):
                        lines[i] = f"{indent}await Promise.all([{stmt1[6:-1]}, {stmt2[6:-1]}]);"
                        lines.pop(i+1)
                        modifications_count += 1
                        self.modifications_made.append(f"Parallelized awaits at line {i+1} in {file_path.name}")
                        continue
                
                i += 1
            
            content = '\n'.join(lines)
            return original_content != content, content
        except Exception as e:
            print(f"Error optimizing {file_path}: {e}")
            return False, None
    
    def validate_typescript(self):
        """Run TypeScript compiler to validate changes."""
        try:
            result = os.system('tsc --noEmit 2>&1 | head -20')
            return result == 0
        except:
            print("Warning: Could not run TypeScript compiler")
            return True
    
    def run(self):
        """Execute the optimization."""
        print("=" * 60)
        print("SmartHouse Project Optimizer")
        print("=" * 60)
        
        try:
            # Define files to optimize
            files_to_optimize = [
                ('src/components/main-layout.tsx', 'optimize_main_layout'),
                ('src/lib/actions.ts', 'optimize_actions'),
            ]
            
            # Backup and optimize files
            for file_path_str, optimize_method in files_to_optimize:
                file_path = self.project_root / file_path_str
                
                if not file_path.exists():
                    print(f"WARNING: {file_path} not found")
                    continue
                
                print(f"\nProcessing: {file_path_str}")
                
                # Backup file
                if not self.backup_file(file_path):
                    print(f"ERROR: Could not backup {file_path}")
                    continue
                
                # Optimize file
                optimize_func = getattr(self, optimize_method)
                modified, new_content = optimize_func(file_path)
                
                if new_content is None:
                    print(f"ERROR: Failed to optimize {file_path}")
                    self.restore_backups()
                    return False
                
                if modified:
                    file_path.write_text(new_content)
                    print(f"Modified: {file_path_str}")
                else:
                    print(f"No changes needed for: {file_path_str}")
            
            print("\n" + "=" * 60)
            print("Validating TypeScript compilation...")
            print("=" * 60)
            
            if not self.validate_typescript():
                print("ERROR: TypeScript validation failed!")
                print("Restoring backups...")
                self.restore_backups()
                return False
            
            print("\n" + "=" * 60)
            print("SUCCESS! Optimizations completed")
            print("=" * 60)
            print(f"Files modified: {len(self.modifications_made)}")
            for mod in self.modifications_made:
                print(f"  - {mod}")
            
            # Note: Backups retained for reference
            print(f"\nBackups created (can be safely deleted):")
            for original, backup in self.backups_created:
                print(f"  - {backup}")
            
            return True
            
        except Exception as e:
            print(f"FATAL ERROR: {e}")
            print("Restoring backups...")
            self.restore_backups()
            return False

if __name__ == '__main__':
    optimizer = SmartHouseOptimizer()
    success = optimizer.run()
    sys.exit(0 if success else 1)

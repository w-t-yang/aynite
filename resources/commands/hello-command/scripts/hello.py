import os
import sys

def main():
    # Basic greeting
    name = sys.argv[1] if len(sys.argv) > 1 else "World"
    print(f"Hello, {name}!")

    # Demonstrating environment variable usage
    current_file = os.environ.get('AYNITE_CURRENT_FILE')
    
    print("\n[Command Logic] This command can read environment variables provided by Aynite IDE.")
    
    if current_file:
        print(f"AYNITE_CURRENT_FILE is set to: {current_file}")
    else:
        print("AYNITE_CURRENT_FILE is not set (is there an active tab?)")

if __name__ == "__main__":
    main()

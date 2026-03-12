dev:
    bun run dev data/left data/right

build-nix:
    nix build

run-nix:
    nix run

run-nix-data:
    nix run . -- data/left data/right

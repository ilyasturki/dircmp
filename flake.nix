{
  description = "Terminal TUI for comparing two directories side by side";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          node_modules = pkgs.stdenv.mkDerivation {
            pname = "dirdiff-node-modules";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.bun ];
            dontFixup = true;
            impureEnvVars = pkgs.lib.fetchers.proxyImpureEnvVars;
            outputHashMode = "recursive";
            outputHash = "sha256-/gKi/0I2+qSg+3ollB5wHJXIzo2BvkRZ7bKoa3VQ4zs=";
            buildPhase = ''
              export HOME=$TMPDIR
              bun install --frozen-lockfile --no-progress
            '';
            installPhase = ''
              cp -r node_modules $out
            '';
          };
        in
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "dirdiff";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [
              pkgs.bun
              pkgs.makeWrapper
            ];
            buildPhase = ''
              cp -r ${node_modules} node_modules
              bun build src/index.tsx --outfile dist/index.js --target=bun --external react-devtools-core
            '';
            installPhase = ''
              mkdir -p $out/lib/dirdiff $out/bin
              cp dist/index.js $out/lib/dirdiff/
              makeWrapper ${pkgs.bun}/bin/bun $out/bin/dirdiff \
                --add-flags "$out/lib/dirdiff/index.js"
            '';
          };
        }
      );
    };
}

# API El Resto : image pour Render (contexte de build = dossier backend).
#   docker build -f backend/Dockerfile backend
# Aucun secret ici : chaîne de connexion, clé Jwt, etc. sont fournies au conteneur par variables d'environnement.

# --- Étape 1 : restauration et publication ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Le .csproj seul d'abord : la restauration reste en cache tant qu'il ne change pas.
COPY src/Resto.Api/Resto.Api.csproj src/Resto.Api/
RUN dotnet restore src/Resto.Api/Resto.Api.csproj

COPY src/Resto.Api/ src/Resto.Api/
# catalogue.json et demo.json suivent (Content copié à la publication, voir Resto.Api.csproj).
RUN dotnet publish src/Resto.Api/Resto.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# --- Étape 2 : exécution ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Port d'écoute lu par Program.cs dans PORT (Render le fournit ; 10000 par défaut).
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS= \
    PORT=10000
EXPOSE 10000

# Utilisateur non-root fourni par l'image officielle (UID 1654).
USER $APP_UID

# Migration ponctuelle : docker run ... <image> --migrate
ENTRYPOINT ["dotnet", "Resto.Api.dll"]

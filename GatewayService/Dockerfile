FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["GatewayService.csproj", "./"]
RUN dotnet restore "GatewayService.csproj"
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "GatewayService.dll"]

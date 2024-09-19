FROM mcr.microsoft.com/dotnet/runtime:8.0 AS base
RUN apt update -y && apt install python3 -y
RUN apt install -y python3-pip
RUN pip3 install rembg[cli] --break-system-packages
USER $APP_UID
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ketchupbot-discord/ketchupbot-discord.csproj", "ketchupbot-discord/"]
RUN dotnet restore "ketchupbot-discord/ketchupbot-discord.csproj"
COPY . .
WORKDIR "/src/ketchupbot-discord"
RUN dotnet build "ketchupbot-discord.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ketchupbot-discord.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "ketchupbot-discord.dll"]

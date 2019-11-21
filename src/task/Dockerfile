FROM mcr.microsoft.com/dotnet/core/sdk:3.0-alpine AS build
WORKDIR /app

# copy csproj and restore as distinct layers
COPY *.csproj ./dotnetapp/
WORKDIR /app/dotnetapp
RUN dotnet restore

# copy and publish app and libraries
WORKDIR /app/
COPY . ./dotnetapp/
WORKDIR /app/dotnetapp
RUN dotnet publish -c Release -o out


FROM mcr.microsoft.com/dotnet/core/runtime:3.0-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dotnetapp/out ./
ENTRYPOINT ["dotnet", "task.dll"]
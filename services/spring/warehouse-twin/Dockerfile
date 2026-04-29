# ----------------------------------
# Stage 1: Build the Java JAR
# ----------------------------------
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Step 1: Copy pom.xml and download dependencies (Optimized for Docker Cache)
# This ensures that if you only change code, Docker doesn't re-download the internet
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Step 2: Copy the source code
COPY src ./src

# Step 3: Compile and package the application
# -DskipTests ensures the build is fast during deployment
RUN mvn clean package -DskipTests

# ----------------------------------
# Stage 2: Final Runtime Image
# ----------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root user for security best practices (Matching your Go twin)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the compiled jar from the builder stage
# Spring Initializr names it based on the artifact id and version
COPY --from=builder /app/target/*.jar app.jar

# Set ownership to the non-root user
RUN chown appuser:appgroup app.jar

USER appuser:appgroup

# Expose the specific twin port
EXPOSE 9084

# Run the Spring Boot application
# Note: For advanced performance testing later, we can inject JVM flags here
# (e.g., -Xms512m -Xmx512m -XX:+UseZGC) via docker-compose environment variables.
ENTRYPOINT ["java", "-Xms256m", "-Xmx512m", "-XX:+UseG1GC", "-XX:+PrintGCDetails", "-Xlog:gc*:file=/tmp/gc.log", "-jar", "app.jar"]

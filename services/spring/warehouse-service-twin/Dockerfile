# ----------------------------------
# Stage 1: Build the Application
# ----------------------------------
FROM maven:3.9.6-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy only the pom.xml first (to cache dependencies)
COPY pom.xml .

# Download dependencies (this step is cached if pom.xml doesn't change)
RUN mvn dependency:go-offline -B

# Copy the source code
COPY src ./src

# Build the JAR (skipping tests to save the time during container build)
RUN mvn clean package -DskipTests

# ----------------------------------
# Stage 2: Run the Application
# ----------------------------------
# Use a smaller runtime image for the final container
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy the built JAR from the 'builder' stage
COPY --from=builder /app/target/*.jar app.jar

# Expose the port defined in application.properties
EXPOSE 9084

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]

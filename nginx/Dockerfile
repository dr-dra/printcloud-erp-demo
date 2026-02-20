# ============================================================================
# NGINX DOCKERFILE
# ============================================================================
# This creates a simple Nginx container with our custom configuration.
#
# Nginx is a lightweight web server and reverse proxy.
# We use the Alpine variant for minimal image size.
# ============================================================================

FROM nginx:alpine

# Remove the default Nginx configuration
# We'll use our custom configuration instead
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration
# This replaces the default configuration with our PrintCloud setup
COPY nginx.conf /etc/nginx/conf.d/

# Expose port 80 (HTTP)
# In production with SSL, you'd also expose port 443 (HTTPS)
EXPOSE 80

# The default CMD from nginx:alpine starts Nginx
# No need to override it - it runs: nginx -g 'daemon off;'

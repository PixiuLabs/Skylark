package org.skylark.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC Configuration
 * Web MVC 配置
 * 
 * <p>Configures static resource locations, including the web/ directory
 * in the project root for serving HTML, JavaScript, and other web assets.</p>
 * 
 * @author Skylark Team
 * @version 1.0.0
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Add web directory as a static resource location
        // This allows serving files from the project root's web/ directory
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/", "classpath:/public/", "file:web/");
    }
}

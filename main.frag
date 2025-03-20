precision highp float;
// sample2D is how we store a texture
uniform sampler2D u_Texture;

// Holds our uv coordinates of the texture per fragment
varying vec2 v_TexCoord;

// How much "spread" we allow
uniform float u_SpecPower;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

// if we are using flat lighting, give a color to use
uniform vec3 u_FlatColor;

// Main light position
uniform vec3 u_Light;

// Model-world inverse transpose matrix
uniform mat4 u_ModelWorldInverseTranspose;

// Camera matrix
uniform mat4 u_Camera;


// Point lights (fireflies)
// Each light is 7 floats: position (xyz), color (rgb), intensity
#define MAX_POINT_LIGHTS 10
uniform float u_PointLights[MAX_POINT_LIGHTS * 7];
uniform int u_PointLightCount;

// World position from vertex shader
varying vec3 v_WorldPosition;
varying vec3 v_Normal;
varying vec3 v_Position;

// Calculate lighting from a point light
vec3 calculatePointLight(vec3 worldPosition, vec3 worldNormal, vec3 lightPos, vec3 lightColor, float lightIntensity, vec3 texColor) {
    // Direction from fragment to light
    vec3 lightDir = normalize(lightPos - worldPosition);
    
    // Diffuse lighting
    float diffuse = max(dot(lightDir, worldNormal), 0.0) * lightIntensity;
    
    // Attenuation based on distance - increased falloff for more localized light
    float distance = length(lightPos - worldPosition);
    float attenuation = 1.0 / (1.0 + 0.25 * distance + 0.05 * distance * distance);
    
    // Final contribution - multiply by 1.5 to make the light more visible
    return diffuse * attenuation * lightColor * texColor * 1.5;
}

void main() {
    if (u_FlatLighting) {
        // use the provided flat color
        gl_FragColor = vec4(u_FlatColor, 1.0);
    }
    else {
        // Calculate positions and normals
        vec3 worldPosition = v_WorldPosition;
        vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));
        vec3 cameraSpacePosition = vec3(u_Camera * vec4(worldPosition, 1.0));

        // Check if main light is enabled by testing if it's not a zero vector
        bool mainLightEnabled = length(u_Light) > 0.001;
        
        // Default values for when main light is disabled
        float diffuse = 0.0;
        float specular = 0.0;
        
        if (mainLightEnabled) {
            // Work out the direction from our main light to our position
            vec3 lightDir = normalize(u_Light - worldPosition);

            // Calculate our fragment diffuse amount
            diffuse = max(dot(lightDir, worldNormal), 0.0);

            // Calculate our reflection across the normal and into camera space
            vec3 reflectDir = normalize(reflect(-lightDir, worldNormal));
            vec3 cameraReflectDir = vec3(u_Camera * vec4(reflectDir, 0.0));

            // our camera is at the origin of camera space, so calculate direction from that
            vec3 cameraDir = normalize(vec3(0.0, 0.0, 0.0) - cameraSpacePosition);

            // use the angle to calculate specular
            float angle = max(dot(cameraDir, cameraReflectDir), 0.0);
            specular = max(pow(angle, u_SpecPower), 0.0);
        }

        vec3 specularColor = vec3(0.8, 0.8, 0.8);

        // texture color
        float u_Ambient = 0.1;
        vec3 texColor = vec3(texture2D(u_Texture, v_TexCoord));

        // add up and save our components from main light
        vec3 color = (u_Ambient + diffuse) * texColor + specular * specularColor;

        // Add contributions from point lights (fireflies)
        vec3 fireflyLight = vec3(0.0, 0.0, 0.0);
       if (u_PointLightCount > 0) {
            vec3 lightPos = vec3(u_PointLights[0], u_PointLights[1], u_PointLights[2]);
            vec3 lightColor = vec3(u_PointLights[3], u_PointLights[4], u_PointLights[5]);
            float lightIntensity = u_PointLights[6];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 1) {
            vec3 lightPos = vec3(u_PointLights[7], u_PointLights[8], u_PointLights[9]);
            vec3 lightColor = vec3(u_PointLights[10], u_PointLights[11], u_PointLights[12]);
            float lightIntensity = u_PointLights[13];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 2) {
            vec3 lightPos = vec3(u_PointLights[14], u_PointLights[15], u_PointLights[16]);
            vec3 lightColor = vec3(u_PointLights[17], u_PointLights[18], u_PointLights[19]);
            float lightIntensity = u_PointLights[20];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 3) {
            vec3 lightPos = vec3(u_PointLights[21], u_PointLights[22], u_PointLights[23]);
            vec3 lightColor = vec3(u_PointLights[24], u_PointLights[25], u_PointLights[26]);
            float lightIntensity = u_PointLights[27];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 4) {
            vec3 lightPos = vec3(u_PointLights[28], u_PointLights[29], u_PointLights[30]);
            vec3 lightColor = vec3(u_PointLights[31], u_PointLights[32], u_PointLights[33]);
            float lightIntensity = u_PointLights[34];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 5) {
            vec3 lightPos = vec3(u_PointLights[35], u_PointLights[36], u_PointLights[37]);
            vec3 lightColor = vec3(u_PointLights[38], u_PointLights[39], u_PointLights[40]);
            float lightIntensity = u_PointLights[41];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 6) {
            vec3 lightPos = vec3(u_PointLights[42], u_PointLights[43], u_PointLights[44]);
            vec3 lightColor = vec3(u_PointLights[45], u_PointLights[46], u_PointLights[47]);
            float lightIntensity = u_PointLights[48];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 7) {
            vec3 lightPos = vec3(u_PointLights[49], u_PointLights[50], u_PointLights[51]);
            vec3 lightColor = vec3(u_PointLights[52], u_PointLights[53], u_PointLights[54]);
            float lightIntensity = u_PointLights[55];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 8) {
            vec3 lightPos = vec3(u_PointLights[56], u_PointLights[57], u_PointLights[58]);
            vec3 lightColor = vec3(u_PointLights[59], u_PointLights[60], u_PointLights[61]);
            float lightIntensity = u_PointLights[62];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        if (u_PointLightCount > 9) {
            vec3 lightPos = vec3(u_PointLights[63], u_PointLights[64], u_PointLights[65]);
            vec3 lightColor = vec3(u_PointLights[66], u_PointLights[67], u_PointLights[68]);
            float lightIntensity = u_PointLights[69];
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        
        // If main light is disabled, increase ambient and firefly contribution
        if (!mainLightEnabled) {
            // Increase ambient light slightly when main light is off
            // to make the scene still visible but darker
            float enhancedAmbient = 0.15;
            color = enhancedAmbient * texColor;
            
            // Make fireflies more prominent when main light is off
            fireflyLight *= 1.5;
        }
        
        // Add firefly light to the scene
        color += fireflyLight;
    
        gl_FragColor = vec4(color, 1.0);
    }
}


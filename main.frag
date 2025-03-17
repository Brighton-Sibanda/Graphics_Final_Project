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
#define MAX_POINT_LIGHTS 50
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

        // Work out the direction from our main light to our position
        vec3 lightDir = normalize(u_Light - worldPosition);

        // Calculate our fragment diffuse amount
        float diffuse = max(dot(lightDir, worldNormal), 0.0);

        // Calculate our reflection across the normal and into camera space
        vec3 reflectDir = normalize(reflect(-lightDir, worldNormal));
        vec3 cameraReflectDir = vec3(u_Camera * vec4(reflectDir, 0.0));

        // our camera is at the origin of camera space, so calculate direction from that
        vec3 cameraDir = normalize(vec3(0.0, 0.0, 0.0) - cameraSpacePosition);

        // use the angle to calculate specular
        float angle = max(dot(cameraDir, cameraReflectDir), 0.0);
        float specular = max(pow(angle, u_SpecPower), 0.0);

        vec3 specularColor = vec3(1.0, 1.0, 1.0);

        // texture color
        float u_Ambient = 0.1;
        vec3 texColor = vec3(texture2D(u_Texture, v_TexCoord));

        // add up and save our components from main light
        vec3 color = (u_Ambient + diffuse) * texColor + specular * specularColor;
        
        // Add contributions from point lights (fireflies)
        vec3 fireflyLight = vec3(0.0, 0.0, 0.0);
        for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
            if (i >= u_PointLightCount) break;
            
            int idx = i * 7;
            vec3 lightPos = vec3(u_PointLights[idx], u_PointLights[idx+1], u_PointLights[idx+2]);
            vec3 lightColor = vec3(u_PointLights[idx+3], u_PointLights[idx+4], u_PointLights[idx+5]);
            float lightIntensity = u_PointLights[idx+6];
            
            fireflyLight += calculatePointLight(worldPosition, worldNormal, lightPos, lightColor, lightIntensity, texColor);
        }
        
        // Add firefly light to the scene with a subtle effect
        color += fireflyLight;
    
        gl_FragColor = vec4(color, 1.0);
    }
}


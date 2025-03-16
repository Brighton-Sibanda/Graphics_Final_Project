precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;

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

void main() {
    if (u_FlatLighting) {
        // use a slightly faded green "by default"
        gl_FragColor = vec4(u_FlatColor, 1.0);
    }
    else {
        // Calculate positions and normals
        vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));
        vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));
        vec3 cameraSpacePosition = vec3(u_Camera * vec4(worldPosition, 1.0));

        // Work out the direction from our light to our position
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

        // add up and save our components
        vec3 color = (u_Ambient + diffuse) * texColor + specular * specularColor;
        gl_FragColor = vec4(color, 1.0);
    }
}
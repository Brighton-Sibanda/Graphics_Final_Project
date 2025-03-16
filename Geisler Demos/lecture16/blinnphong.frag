precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;

// How much "spread" we allow
uniform float u_SpecPower;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

void main() {
    if (u_FlatLighting) {
        // use a bright green "by default"
        gl_FragColor = vec4(0.0, 0.6, 0.2, 1.0);
    }
    else {
        // Calculate our world position
        vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));

        // Calculate our world space normal
        vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));

        // Our light direction to our current fragment position
        vec3 lightDir = normalize(u_Light - worldPosition);

        // Calculate our diffuse amount
        float diffuse = max(dot(lightDir, worldNormal), 0.0);

        // Calculate our reflection across the normal
        // see https://learnopengl.com/Lighting/Basic-Lighting for more details
        vec3 reflectDir = normalize(reflect(-lightDir, worldNormal)); // reflect the light past our normal

        // Convert our reflection direction into camera space
        // Note that we do not need the inverse transpose (it's not a normal anymore)
        // But it's still a direction, so throw out any translation that would happen
        vec3 cameraReflectDir = vec3(u_Camera * vec4(reflectDir, 0.0));

        // next, calculate position in camera space
        vec3 cameraSpacePosition = vec3(u_Camera * vec4(worldPosition, 1.0));

        // our camera is at the origin of camera space, so calculate direction from that
        vec3 cameraDir = normalize(vec3(0.0, 0.0, 0.0) - cameraSpacePosition);

        // we also need to put the light direction and normal in camera space
        vec3 cameraLightDir = normalize(vec3(mat4(u_Camera) * vec4(lightDir, 0.0)));
        vec3 cameraNormal = normalize(vec3(mat4(u_Camera) * vec4(worldNormal, 0.0)));

        // Calculate the half-angle between the light and the camera
        vec3 halfwayDir = normalize(cameraLightDir + cameraDir);

        // calculate the angle between the cameraDir and
        //   the reflected light direction _toward_ the camera(in camera space)
        float angle = max(dot(cameraNormal, halfwayDir), 0.0);
        // calculate fall-off with power
        float specular = max(pow(angle, u_SpecPower), 0.0);

        // set constant colors for this demo
        vec3 diffuseColor = vec3(0.7, 0.2, 0.5);
        vec3 specularColor = vec3(1.0, 1.0, 1.0);
        vec3 ambientColor = vec3(0.15, 0.1, 0.05);

        // add up our components
        vec3 color = ambientColor + diffuse * diffuseColor + specular * specularColor;

        gl_FragColor = vec4(color, 1.0);
    }
}
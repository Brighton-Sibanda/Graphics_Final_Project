precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;
uniform vec3 u_AmbientColor;
uniform vec3 u_DiffuseColor;
uniform vec3 u_SpecColor;

// How much "spread" we allow
uniform float u_SpecPower;

void main() {
    // Calculate our world information
    vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));
    vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));
    vec3 lightDir = normalize(u_Light - worldPosition);

    // Calculate our diffuse amount
    float diffuse = max(dot(lightDir, worldNormal), 0.0);

    // Calculate camera reflections and position
    vec3 reflectDir = normalize(reflect(-lightDir, worldNormal));
    vec3 cameraReflectDir = vec3(u_Camera * vec4(reflectDir, 0.0));

    // Calculate camera direction
    vec3 cameraSpacePosition = vec3(u_Camera * vec4(worldPosition, 1.0));
    vec3 cameraDir = normalize(vec3(0.0, 0.0, 0.0) - cameraSpacePosition);

    // Calculate specular with power
    float angle = max(dot(cameraDir, cameraReflectDir), 0.0);
    float specular = max(pow(angle, u_SpecPower), 0.0);

    // add up our components
    vec3 color = u_AmbientColor + diffuse * u_DiffuseColor + specular * u_SpecColor;

    gl_FragColor = vec4(color, 1.0);
}
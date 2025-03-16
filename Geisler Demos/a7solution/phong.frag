precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;

uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;

// the colors we use when calculating lighting
uniform vec3 u_AmbientColor;
uniform vec3 u_DiffuseColor;
uniform vec3 u_SpecularColor;

// How much "spread" we allow
uniform float u_SpecularPower;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

void main() {
    // Calculate our world position
    vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));

    // Calculate our world space normal
    vec3 worldNormal = normalize(vec3(u_ModelWorldInverseTranspose * vec4(v_Normal, 0.0)));

    // Our light direction is just our normalized light source
    vec3 lightDir = normalize(u_Light);

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

    // calculate the angle between the cameraDir and
    //   the reflected light direction _toward_ the camera(in camera space)
    float angle = max(dot(cameraDir, cameraReflectDir), 0.0);
    // calculate fall-off with power
    float specular = max(pow(angle, u_SpecularPower), 0.0);

    // add up our components
    vec3 color = u_AmbientColor + 
        diffuse * u_DiffuseColor + 
        specular * u_SpecularColor;

    gl_FragColor = vec4(color, 1.0);
}
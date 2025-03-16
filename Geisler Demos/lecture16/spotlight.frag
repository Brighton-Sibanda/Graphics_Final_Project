precision highp float;
varying vec3 v_Normal;
varying vec3 v_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;

// Light properties
uniform float u_SpecPower;
uniform float u_Constant;
uniform float u_Linear;
uniform float u_Quadratic;
uniform vec3 u_SpotlightDirection; // where the spotlight is "looking"
uniform float u_SpotlightSize;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

// helper function for the homogeneous transformation
vec3 hom_reduce(vec4 v) {
    // component-wise division of v
    return vec3(v) / v.w;
}

void main() {
    if (u_FlatLighting) {
        // use a bright green "by default"
        gl_FragColor = vec4(0.0, 0.6, 0.2, 1.0);
    }
    else {
        // set constant colors for this demo
        vec3 diffuseColor = vec3(0.7, 0.2, 0.5);
        vec3 specularColor = vec3(1.0, 1.0, 1.0);
        vec3 ambientColor = vec3(0.0, 0.0, 0.0);

        // usual normal transformation
        vec3 worldNormal = normalize(mat3(u_ModelWorldInverseTranspose) * normalize(v_Normal));
        // usual position transformation
        vec3 worldPosition = hom_reduce(u_World * u_Model * vec4(v_Position, 1.0));

        // we _first_ need to calculate our light direction to determine if we're "in" the spotlight
        vec3 lightDir = normalize(u_Light - worldPosition); // get the direction towards the light
        float theta = dot(lightDir, normalize(u_SpotlightDirection));

        // do our calculations normally if we're in the light source
        if (theta > u_SpotlightSize) {
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
            float specular = max(pow(angle, u_SpecPower), 0.0);

            // add up our components
            vec3 color = ambientColor + diffuse * diffuseColor + specular * specularColor;

            // calculate attenuation
            float lightDistance = length(u_Light - worldPosition);
            float attenuation = u_Constant +
                u_Linear * lightDistance +
                u_Quadratic * lightDistance * lightDistance;

            gl_FragColor = vec4(color / attenuation, 1.0);
        }
        else { // we're not in the spotlight
            gl_FragColor = vec4(ambientColor, 1.0);
        }
    }
}
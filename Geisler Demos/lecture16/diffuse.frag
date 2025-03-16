precision highp float;
varying vec3 v_Position;
varying vec3 v_Normal;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_ModelWorldInverseTranspose;
uniform vec3 u_Light;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

void main() {
    if (u_FlatLighting) {
        // use a bright green "by default"
        gl_FragColor = vec4(0.0, 0.6, 0.2, 1.0);
    }
    else {
        // convert our position into world space
        vec3 worldPosition = vec3(u_World * u_Model * vec4(v_Position, 1.0));

        // Treat the normal as a direction for geometric calculation
        vec4 normalDirection = vec4(v_Normal, 0.0);
        // Multiply by our InverseTranspose
        vec4 worldNormalDirection = u_ModelWorldInverseTranspose * normalDirection;

        // Convert back to cart3 and normalize
        // We don't divide by w, since we took w to be zero!
        vec3 worldNormal = normalize(vec3(worldNormalDirection));

        // Get the direction between the light and our fragment
        vec3 lightDir = normalize(u_Light - worldPosition);

        // Calculate the amount of diffuse light
        float diffuse = max(dot(lightDir, worldNormal), 0.0);

        // set a constant diffuse color
        vec3 diffuseColor = vec3(0.4, 0.0, 1.0);

        gl_FragColor = vec4(diffuse * diffuseColor, 1.0);
    }
}
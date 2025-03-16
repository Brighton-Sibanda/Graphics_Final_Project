precision highp float;

// sample2D is how we store a texture
uniform sampler2D u_Texture;

// needed for sampling
varying vec2 v_Offset;

// Holds our uv coordinates of the texture per fragment
varying vec2 v_TexCoord;
varying vec2 v_TexLeft;
varying vec2 v_TexRight;
varying vec2 v_TexUp;
varying vec2 v_TexDown;
void main() {
    vec2 coord = v_TexCoord;
    vec4 color = texture2D(u_Texture, v_TexCoord);
    color += texture2D(u_Texture, v_TexLeft);
    color += texture2D(u_Texture, v_TexRight);
    color += texture2D(u_Texture, v_TexDown);
    color += texture2D(u_Texture, v_TexUp);
    gl_FragColor = color / 5.0;
}